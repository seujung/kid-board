import { canToggle } from "../core/boardState";
import { compareDay, dayDateOf, sameDay } from "../core/dayDate";
import type { DayDate, TimeOfDay } from "../core/dayDate";
import type { DimPeriod } from "../core/displayPolicy";
import type { BoardData, ChildCalendar, ChildInfo, TaskInfo, TimeSlot, Weekday } from "../core/domain";
import {
  hashSecret,
  isLocked,
  isValidPin,
  makeRecoveryCode,
  makeSalt,
  recordFailure,
  recordSuccess,
} from "../core/parentLock";
import type { Lockout } from "../core/parentLock";
import type { GeoPlace, WeatherSnapshot } from "../core/weather";
import { changeSchedule } from "../core/scheduleEditor";
import type { DocStorage } from "./idb";
import { emptyDoc, migrate } from "./schema";
import type { AppDoc, Settings, SoundSettings } from "./schema";
import { defaultTimes, seedData } from "./seed";

export type StoreStatus = "ok" | "readOnlyError";
export type VerifyResult = "ok" | "wrong" | { lockedUntil: number };

/** 저장된 문서를 읽지 못해 읽기 전용으로 열린 저장소에 쓰려고 하면 던집니다. */
export class StoreReadOnlyError extends Error {
  constructor() {
    super("store is read-only because the saved document could not be read");
    this.name = "StoreReadOnlyError";
  }
}

export class InvalidPinError extends Error {
  constructor() {
    super("PIN must be exactly four digits");
    this.name = "InvalidPinError";
  }
}

function randomHexID(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let s = "";
  bytes.forEach((b) => {
    s += (b < 16 ? "0" : "") + b.toString(16);
  });
  return s;
}

export function defaultNewID(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return randomHexID();
}

function logSaveError(err: unknown): void {
  console.warn("lockout state was not saved", err);
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const result = items.slice();
  if (from < 0 || from >= result.length) return result;
  const [item] = result.splice(from, 1);
  const target = Math.max(0, Math.min(to, result.length));
  result.splice(target, 0, item as T);
  return result;
}

function byOrder<T extends { order: number; id: string }>(a: T, b: T): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * 앱 문서를 메모리에 들고 있고 변경마다 저장소에 저장합니다.
 * 각 변경은 메모리를 바꾸고, 스냅숏 캐시를 비우고, 저장을 시작하고, 구독자에게 한 번 알립니다.
 * 저장은 순서대로 하나씩 실행합니다. 반환된 Promise는 그 변경의 저장이 끝나면 풀립니다.
 */
export class BoardStore {
  status: StoreStatus;
  /** 읽기 전용이 된 이유입니다. 정상이면 null입니다. */
  readonly errorReason: "corrupt" | "future" | "loadFailed" | null;

  private current: AppDoc;
  /** 마지막으로 저장에 성공한 문서입니다. 저장이 실패하면 메모리를 이 문서로 되돌립니다. */
  private persisted: AppDoc;
  private cache: BoardData | null = null;
  private listeners = new Set<() => void>();
  private saveChain: Promise<void> = Promise.resolve();

  private constructor(
    private readonly storage: DocStorage,
    private readonly now: () => Date,
    private readonly newID: () => string,
    doc: AppDoc,
    errorReason: "corrupt" | "future" | "loadFailed" | null,
  ) {
    this.current = doc;
    this.persisted = doc;
    this.errorReason = errorReason;
    this.status = errorReason === null ? "ok" : "readOnlyError";
  }

  /** 저장소를 읽어 엽니다. 문서가 없으면 빈 문서로 시작합니다(시드는 넣지 않습니다). */
  static async open(storage: DocStorage, now: () => Date, newID: () => string = defaultNewID): Promise<BoardStore> {
    let raw: unknown;
    try {
      raw = await storage.load();
    } catch {
      return new BoardStore(storage, now, newID, emptyDoc(), "loadFailed");
    }
    if (raw === null || raw === undefined) return new BoardStore(storage, now, newID, emptyDoc(), null);
    const result = migrate(raw);
    if (!result.ok) return new BoardStore(storage, now, newID, emptyDoc(), result.reason);
    return new BoardStore(storage, now, newID, result.doc, null);
  }

  // MARK: Reading

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** 변경 전까지 같은 객체를 돌려줍니다. 자녀는 `order` 순서입니다. */
  snapshot(): BoardData {
    if (!this.cache) {
      const data = this.current.data;
      this.cache = { ...data, children: data.children.slice().sort(byOrder) };
    }
    return this.cache;
  }

  settings(): Settings {
    return this.current.settings;
  }

  weather(): WeatherSnapshot | null {
    return this.current.weather;
  }

  /** 현재 문서 전체입니다. 백업 파일을 만들 때 씁니다. */
  doc(): AppDoc {
    return this.current;
  }

  get hasPin(): boolean {
    return this.current.settings.pinHash !== null;
  }

  private today(): DayDate {
    return dayDateOf(this.now());
  }

  // MARK: Commit

  private ensureWritable(): void {
    if (this.status !== "ok") throw new StoreReadOnlyError();
  }

  /**
   * 새 문서로 바꾸고 저장을 줄에 세운 뒤 알립니다.
   * 저장이 실패하면 그 뒤에 다른 변경이 없을 때만 메모리를 마지막으로 저장된 문서로 되돌리고 다시 알립니다.
   * 뒤에 다른 변경이 있으면 그 변경의 저장이 전체 문서를 쓰므로 메모리를 그대로 둡니다.
   * PIN과 복구 코드의 잠금 상태는 되돌리지 않습니다. 저장이 계속 실패해도 틀린 횟수가 쌓여야 하기 때문입니다.
   */
  private commit(next: AppDoc): Promise<void> {
    this.ensureWritable();
    this.current = next;
    this.cache = null;
    const saving = this.saveChain.then(() => this.storage.save(next));
    this.saveChain = saving.then(
      () => {
        this.persisted = next;
      },
      () => undefined,
    );
    this.notify();
    return saving.catch((err: unknown) => {
      if (this.current === next) {
        const keep = this.current.settings;
        this.current = {
          ...this.persisted,
          settings: { ...this.persisted.settings, lockout: keep.lockout, recoveryLockout: keep.recoveryLockout },
        };
        this.cache = null;
        this.notify();
      }
      throw err;
    });
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private commitData(change: (data: BoardData) => BoardData): Promise<void> {
    this.ensureWritable();
    return this.commit({ ...this.current, data: change(this.current.data) });
  }

  private commitSettings(change: Partial<Settings>, extra: Partial<AppDoc> = {}): Promise<void> {
    this.ensureWritable();
    return this.commit({ ...this.current, ...extra, settings: { ...this.current.settings, ...change } });
  }

  // MARK: Seed

  /** 첫 실행에만 예시 데이터를 넣습니다. 자녀가 이미 있으면 넣지 않고 `didSeed`만 기록합니다. */
  async seedIfNeeded(): Promise<void> {
    this.ensureWritable();
    if (this.current.settings.didSeed) return;
    const data = this.current.data.children.length === 0 ? seedData(this.today(), this.newID) : this.current.data;
    await this.commit({ ...this.current, data, settings: { ...this.current.settings, didSeed: true } });
  }

  // MARK: Children

  /** 자녀를 더하고 요일마다 기본 시각을 넣습니다. */
  async addChild(name: string, avatar: string, themeColor: string, calendars: ChildCalendar[] = []): Promise<string> {
    this.ensureWritable();
    const id = this.newID();
    const copy = calendars.map((cal) => ({ ...cal }));
    await this.commitData((d) => {
      const order = d.children.reduce((m, c) => Math.max(m, c.order), -1) + 1;
      return {
        ...d,
        children: d.children.concat([{ id, name, avatar, themeColor, order, calendars: copy }]),
        times: d.times.concat(defaultTimes(id)),
      };
    });
    return id;
  }

  /** 없는 자녀면 아무것도 하지 않습니다. */
  async updateChild(info: ChildInfo): Promise<void> {
    this.ensureWritable();
    if (!this.current.data.children.some((c) => c.id === info.id)) return;
    const copy: ChildInfo = { ...info, calendars: info.calendars.map((cal) => ({ ...cal })) };
    await this.commitData((d) => ({ ...d, children: d.children.map((c) => (c.id === info.id ? copy : c)) }));
  }

  /** 자녀와 자녀의 할 일, 일정, 시각, 완료 기록을 지웁니다. */
  async deleteChild(id: string): Promise<void> {
    this.ensureWritable();
    await this.commitData((d) => {
      const taskIDs = new Set(d.tasks.filter((t) => t.childID === id).map((t) => t.id));
      return {
        children: d.children.filter((c) => c.id !== id),
        tasks: d.tasks.filter((t) => t.childID !== id),
        schedules: d.schedules.filter((s) => !taskIDs.has(s.taskID)),
        times: d.times.filter((t) => t.childID !== id),
        completions: d.completions.filter((c) => c.childID !== id),
      };
    });
  }

  /** `order` 순서 목록에서 `from` 위치의 자녀를 꺼내 `to` 위치에 넣고 `order`를 0부터 다시 매깁니다. */
  async moveChild(from: number, to: number): Promise<void> {
    this.ensureWritable();
    await this.commitData((d) => {
      const moved = moveItem(d.children.slice().sort(byOrder), from, to);
      const orderOf = new Map(moved.map((c, i) => [c.id, i] as [string, number]));
      return { ...d, children: d.children.map((c) => ({ ...c, order: orderOf.get(c.id) ?? c.order })) };
    });
  }

  // MARK: Tasks

  async addTask(childID: string, title: string, icon: string, slot: TimeSlot, weekdays: Weekday[]): Promise<string> {
    this.ensureWritable();
    const id = this.newID();
    const scheduleID = this.newID();
    const today = this.today();
    const createdAt = this.now().getTime();
    await this.commitData((d) => {
      const order = d.tasks.filter((t) => t.childID === childID).reduce((m, t) => Math.max(m, t.order), -1) + 1;
      const task: TaskInfo = { id, childID, title, icon, order, createdAt, archivedOn: null };
      return {
        ...d,
        tasks: d.tasks.concat([task]),
        schedules: d.schedules.concat([
          { id: scheduleID, taskID: id, slot, weekdays: weekdays.slice(), startOn: today, endOn: null },
        ]),
      };
    });
    return id;
  }

  async updateTaskAppearance(taskID: string, title: string, icon: string): Promise<void> {
    this.ensureWritable();
    if (!this.current.data.tasks.some((t) => t.id === taskID)) return;
    await this.commitData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === taskID ? { ...t, title, icon } : t)),
    }));
  }

  /** 오늘부터 적용합니다. 과거 기록이 바뀌지 않도록 필요하면 일정을 나눕니다. */
  async updateTaskSchedule(taskID: string, slot: TimeSlot, weekdays: Weekday[]): Promise<void> {
    this.ensureWritable();
    const today = this.today();
    const newID = this.newID();
    await this.commitData((d) => ({ ...d, schedules: changeSchedule(d.schedules, taskID, slot, weekdays, today, newID) }));
  }

  /** 오늘부터 숨깁니다. 완료 기록은 남깁니다. */
  async archiveTask(taskID: string): Promise<void> {
    this.ensureWritable();
    if (!this.current.data.tasks.some((t) => t.id === taskID)) return;
    const today = this.today();
    await this.commitData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === taskID ? { ...t, archivedOn: today } : t)),
    }));
  }

  /**
   * 자녀의 보관하지 않은 할 일 중 현재 일정(`endOn`이 없음)이 `slot`인 할 일 목록에서
   * `from` 위치의 할 일을 `to` 위치로 옮깁니다. 목록이 쓰던 `order` 값을 새 순서대로 다시 나눠 줍니다.
   * (네이티브 `tasks(of:slot:)`와 같은 목록입니다.)
   */
  async moveTask(childID: string, slot: TimeSlot, from: number, to: number): Promise<void> {
    this.ensureWritable();
    await this.commitData((d) => {
      const ordered = d.tasks
        .filter((t) => t.childID === childID && t.archivedOn === null)
        .filter((t) => d.schedules.some((s) => s.taskID === t.id && s.slot === slot && s.endOn === null))
        .sort(byOrder);
      const slots = ordered.map((t) => t.order).sort((a, b) => a - b);
      const moved = moveItem(ordered, from, to);
      const orderOf = new Map(moved.map((t, i) => [t.id, slots[i] ?? t.order] as [string, number]));
      return { ...d, tasks: d.tasks.map((t) => (orderOf.has(t.id) ? { ...t, order: orderOf.get(t.id)! } : t)) };
    });
  }

  /** 할 일을 다른 자녀에게 복사합니다. 오늘부터 같은 시간대와 요일로 보입니다. 원본이 없으면 null입니다. */
  async copyTask(taskID: string, toChildID: string): Promise<string | null> {
    this.ensureWritable();
    const data = this.current.data;
    const source = data.tasks.find((t) => t.id === taskID);
    if (!source) return null;
    let schedule = null as (typeof data.schedules)[number] | null;
    for (const s of data.schedules) {
      if (s.taskID !== taskID || s.endOn !== null) continue;
      if (!schedule || compareDay(schedule.startOn, s.startOn) < 0) schedule = s;
    }
    return this.addTask(
      toChildID,
      source.title,
      source.icon,
      schedule ? schedule.slot : "morning",
      schedule ? schedule.weekdays : [1, 2, 3, 4, 5, 6, 7],
    );
  }

  // MARK: Times

  async setTimes(childID: string, weekday: Weekday, schoolTime: TimeOfDay | null, bedTime: TimeOfDay): Promise<void> {
    this.ensureWritable();
    await this.commitData((d) => {
      const entry = { childID, weekday, schoolTime: schoolTime ? { ...schoolTime } : null, bedTime: { ...bedTime } };
      const exists = d.times.some((t) => t.childID === childID && t.weekday === weekday);
      return {
        ...d,
        times: exists
          ? d.times.map((t) => (t.childID === childID && t.weekday === weekday ? entry : t))
          : d.times.concat([entry]),
      };
    });
  }

  // MARK: Completion

  /** 지금 누를 수 없는 할 일이면 false를 돌려주고 저장하지 않습니다. */
  async toggleCompletion(childID: string, taskID: string): Promise<boolean> {
    this.ensureWritable();
    const now = this.now();
    if (!canToggle(taskID, childID, now, this.snapshot())) return false;
    const day = dayDateOf(now);
    const matches = (c: { childID: string; taskID: string; day: DayDate }) =>
      c.childID === childID && c.taskID === taskID && sameDay(c.day, day);
    await this.commitData((d) => ({
      ...d,
      completions: d.completions.some(matches)
        ? d.completions.filter((c) => !matches(c))
        : d.completions.concat([{ childID, taskID, day, completedAt: now.getTime() }]),
    }));
    return true;
  }

  // MARK: PIN and recovery code

  /** 새 PIN을 저장하고 PIN 잠금을 풉니다. 새 복구 코드도 만들어 원문을 돌려줍니다. */
  async setPin(pin: string): Promise<string> {
    this.ensureWritable();
    if (!isValidPin(pin)) throw new InvalidPinError();
    const pinSalt = makeSalt();
    const pinHash = await hashSecret(pin, pinSalt);
    const code = makeRecoveryCode();
    const recoverySalt = makeSalt();
    const recoveryHash = await hashSecret(code, recoverySalt);
    await this.commitSettings({
      pinHash,
      pinSalt,
      lockout: recordSuccess(),
      recoveryHash,
      recoverySalt,
      recoveryLockout: recordSuccess(),
    });
    return code;
  }

  /** PIN만 바꾸고 PIN 잠금을 풉니다. 복구 코드는 그대로 둡니다(PIN 변경, 복구 코드로 PIN 다시 정하기). */
  async changePin(pin: string): Promise<void> {
    this.ensureWritable();
    if (!isValidPin(pin)) throw new InvalidPinError();
    const pinSalt = makeSalt();
    const pinHash = await hashSecret(pin, pinSalt);
    await this.commitSettings({ pinHash, pinSalt, lockout: recordSuccess() });
  }

  /** 새 복구 코드를 만들어 원문을 돌려줍니다. 이전 코드는 쓸 수 없게 됩니다. */
  async regenerateRecoveryCode(): Promise<string> {
    this.ensureWritable();
    const code = makeRecoveryCode();
    const recoverySalt = makeSalt();
    const recoveryHash = await hashSecret(code, recoverySalt);
    await this.commitSettings({ recoveryHash, recoverySalt, recoveryLockout: recordSuccess() });
    return code;
  }

  verifyPin(pin: string): Promise<VerifyResult> {
    return this.verify(pin, "pinHash", "pinSalt", "lockout");
  }

  /** 맞아도 복구 코드는 바뀌지 않습니다. */
  verifyRecoveryCode(code: string): Promise<VerifyResult> {
    return this.verify(code, "recoveryHash", "recoverySalt", "recoveryLockout");
  }

  private async verify(
    secret: string,
    hashKey: "pinHash" | "recoveryHash",
    saltKey: "pinSalt" | "recoverySalt",
    lockKey: "lockout" | "recoveryLockout",
  ): Promise<VerifyResult> {
    this.ensureWritable();
    const before: Lockout = this.current.settings[lockKey];
    const startedAt = this.now().getTime();
    if (isLocked(before, startedAt)) return { lockedUntil: before.lockedUntil as number };
    const hash = this.current.settings[hashKey];
    const salt = this.current.settings[saltKey];
    if (hash === null || salt === null) return "wrong";
    const matches = (await hashSecret(secret, salt)) === hash;
    // 해시를 계산하는 동안 바뀌었을 수 있으므로 최신 잠금 상태에 반영합니다.
    const now = this.now().getTime();
    const latest = this.current.settings[lockKey];
    if (matches) {
      // 잠금을 푸는 저장이 실패해도 맞는 PIN은 받아들입니다. 메모리의 잠금은 이미 풀렸습니다.
      if (latest.failures !== 0 || latest.lockedUntil !== null) {
        await this.commitSettings({ [lockKey]: recordSuccess() }).catch(logSaveError);
      }
      return "ok";
    }
    const next = recordFailure(latest, now);
    // 저장이 실패해도 틀린 횟수는 메모리에 남깁니다.
    await this.commitSettings({ [lockKey]: next }).catch(logSaveError);
    return isLocked(next, now) ? { lockedUntil: next.lockedUntil as number } : "wrong";
  }

  // MARK: Location, weather, backup

  /** 지역을 저장하고 이전 지역의 날씨 캐시를 지웁니다. */
  async setLocation(place: GeoPlace): Promise<void> {
    await this.commitSettings({ location: { ...place } }, { weather: null });
  }

  async setWeather(snap: WeatherSnapshot | null): Promise<void> {
    this.ensureWritable();
    await this.commit({ ...this.current, weather: snap });
  }

  /** 화면 끄기 시간 목록을 통째로 바꿉니다. */
  async setDimPeriods(periods: DimPeriod[]): Promise<void> {
    await this.commitSettings({
      dimPeriods: periods.map((p) => ({ id: p.id, start: { ...p.start }, end: { ...p.end }, weekdays: p.weekdays.slice() })),
    });
  }

  /** 완료 소리 설정을 바꿉니다. */
  async setSound(sound: SoundSettings): Promise<void> {
    await this.commitSettings({ sound: { enabled: sound.enabled, volume: sound.volume } });
  }

  async markBackedUp(): Promise<void> {
    await this.commitSettings({ lastBackupAt: this.now().getTime() });
  }

  /**
   * 백업 내용으로 데이터·지역·화면 끄기 시간·소리·날씨를 바꿉니다. 지금 기기의 PIN·복구 코드·잠금과 마지막 백업 시각은 유지합니다.
   * 화면 끄기 시간이나 소리가 없는 백업은 `migrate`가 기본값으로 채웁니다.
   */
  async restore(doc: AppDoc): Promise<void> {
    await this.commitSettings(
      { location: doc.settings.location, didSeed: true, dimPeriods: doc.settings.dimPeriods, sound: { ...doc.settings.sound } },
      { schemaVersion: doc.schemaVersion, data: doc.data, weather: doc.weather },
    );
  }
}
