import type { DayDate, TimeOfDay } from "../core/dayDate";
import type {
  BoardData,
  ChildInfo,
  CompletionInfo,
  DailyTimesInfo,
  TaskInfo,
  TaskScheduleInfo,
  Weekday,
} from "../core/domain";
import { defaultDimPeriods } from "../core/displayPolicy";
import type { DimPeriod } from "../core/displayPolicy";
import { EMPTY_LOCKOUT } from "../core/parentLock";
import type { Lockout } from "../core/parentLock";
import type { GeoPlace, WeatherSnapshot } from "../core/weather";

export const CURRENT_SCHEMA = 1;

export interface Settings {
  pinHash: string | null;
  pinSalt: string | null;
  recoveryHash: string | null;
  recoverySalt: string | null;
  lockout: Lockout;
  recoveryLockout: Lockout;
  location: GeoPlace | null;
  didSeed: boolean;
  /** epoch ms */
  lastBackupAt: number | null;
  /** 화면 끄기 시간입니다. 없던 문서는 기본값(매일 22:00~06:00)으로 읽습니다. 빈 배열이면 끄지 않습니다. */
  dimPeriods: DimPeriod[];
}

export interface AppDoc {
  schemaVersion: number;
  data: BoardData;
  settings: Settings;
  weather: WeatherSnapshot | null;
}

export function emptyDoc(): AppDoc {
  return {
    schemaVersion: CURRENT_SCHEMA,
    data: { children: [], tasks: [], schedules: [], times: [], completions: [] },
    settings: {
      pinHash: null,
      pinSalt: null,
      recoveryHash: null,
      recoverySalt: null,
      lockout: { ...EMPTY_LOCKOUT },
      recoveryLockout: { ...EMPTY_LOCKOUT },
      location: null,
      didSeed: false,
      lastBackupAt: null,
      dimPeriods: defaultDimPeriods(),
    },
    weather: null,
  };
}

export type MigrateResult = { ok: true; doc: AppDoc } | { ok: false; reason: "corrupt" | "future" };

/** 검증에 실패하면 던집니다. `migrate`가 잡아서 "corrupt"로 바꿉니다. */
class Invalid extends Error {}

type Obj = Record<string, unknown>;

function fail(): never {
  throw new Invalid();
}

function obj(v: unknown): Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : fail();
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : fail();
}

function str(v: unknown): string {
  return typeof v === "string" ? v : fail();
}

function num(v: unknown): number {
  return typeof v === "number" && isFinite(v) ? v : fail();
}

function int(v: unknown, min: number, max: number): number {
  const n = num(v);
  return Math.floor(n) === n && n >= min && n <= max ? n : fail();
}

function bool(v: unknown): boolean {
  return typeof v === "boolean" ? v : fail();
}

/** 없으면(undefined) 기본값, 있으면 null 또는 검증한 값입니다. */
function optional<T>(v: unknown, read: (v: unknown) => T, fallback: T): T {
  if (v === undefined) return fallback;
  return read(v);
}

function nullable<T>(read: (v: unknown) => T): (v: unknown) => T | null {
  return (v) => (v === null ? null : read(v));
}

function dayDate(v: unknown): DayDate {
  const o = obj(v);
  return { year: int(o.year, 1, 9999), month: int(o.month, 1, 12), day: int(o.day, 1, 31) };
}

function timeOfDay(v: unknown): TimeOfDay {
  const o = obj(v);
  return { hour: int(o.hour, 0, 23), minute: int(o.minute, 0, 59) };
}

function weekday(v: unknown): Weekday {
  return int(v, 1, 7) as Weekday;
}

function child(v: unknown): ChildInfo {
  const o = obj(v);
  return { id: str(o.id), name: str(o.name), avatar: str(o.avatar), themeColor: str(o.themeColor), order: num(o.order) };
}

function task(v: unknown): TaskInfo {
  const o = obj(v);
  return {
    id: str(o.id),
    childID: str(o.childID),
    title: str(o.title),
    icon: str(o.icon),
    order: num(o.order),
    createdAt: optional(o.createdAt, num, 0),
    archivedOn: optional(o.archivedOn, nullable(dayDate), null),
  };
}

function schedule(v: unknown): TaskScheduleInfo {
  const o = obj(v);
  const slot = o.slot === "morning" || o.slot === "evening" ? o.slot : fail();
  return {
    id: str(o.id),
    taskID: str(o.taskID),
    slot,
    weekdays: arr(o.weekdays).map(weekday),
    startOn: dayDate(o.startOn),
    endOn: optional(o.endOn, nullable(dayDate), null),
  };
}

function times(v: unknown): DailyTimesInfo {
  const o = obj(v);
  return {
    childID: str(o.childID),
    weekday: weekday(o.weekday),
    schoolTime: optional(o.schoolTime, nullable(timeOfDay), null),
    bedTime: timeOfDay(o.bedTime),
  };
}

function completion(v: unknown): CompletionInfo {
  const o = obj(v);
  return { childID: str(o.childID), taskID: str(o.taskID), day: dayDate(o.day), completedAt: num(o.completedAt) };
}

function lockout(v: unknown): Lockout {
  const o = obj(v);
  return { failures: int(o.failures, 0, 1000), lockedUntil: optional(o.lockedUntil, nullable(num), null) };
}

function geoPlace(v: unknown): GeoPlace {
  const o = obj(v);
  return {
    name: str(o.name),
    admin1: optional(o.admin1, nullable(str), null),
    latitude: num(o.latitude),
    longitude: num(o.longitude),
  };
}

function dimPeriod(v: unknown): DimPeriod {
  const o = obj(v);
  return { id: str(o.id), start: timeOfDay(o.start), end: timeOfDay(o.end), weekdays: arr(o.weekdays).map(weekday) };
}

function dimPeriods(v: unknown): DimPeriod[] {
  return arr(v).map(dimPeriod);
}

function weatherSnapshot(v: unknown): WeatherSnapshot {
  const o = obj(v);
  return {
    temperature: num(o.temperature),
    weatherCode: num(o.weatherCode),
    high: num(o.high),
    low: num(o.low),
    precipitationProbability: num(o.precipitationProbability),
    fetchedAt: num(o.fetchedAt),
  };
}

function settings(v: unknown): Settings {
  const o = obj(v);
  return {
    pinHash: optional(o.pinHash, nullable(str), null),
    pinSalt: optional(o.pinSalt, nullable(str), null),
    recoveryHash: optional(o.recoveryHash, nullable(str), null),
    recoverySalt: optional(o.recoverySalt, nullable(str), null),
    lockout: optional(o.lockout, lockout, { ...EMPTY_LOCKOUT }),
    recoveryLockout: optional(o.recoveryLockout, lockout, { ...EMPTY_LOCKOUT }),
    location: optional(o.location, nullable(geoPlace), null),
    didSeed: optional(o.didSeed, bool, false),
    lastBackupAt: optional(o.lastBackupAt, nullable(num), null),
    dimPeriods: optional(o.dimPeriods, dimPeriods, defaultDimPeriods()),
  };
}

/** 날씨는 캐시이므로 형식이 틀리면 버립니다. */
function weatherCache(v: unknown): WeatherSnapshot | null {
  if (v === undefined || v === null) return null;
  try {
    return weatherSnapshot(v);
  } catch (e) {
    if (e instanceof Invalid) return null;
    throw e;
  }
}

function readV1(o: Obj): AppDoc {
  const data = obj(o.data);
  return {
    schemaVersion: CURRENT_SCHEMA,
    data: {
      children: arr(data.children).map(child),
      tasks: arr(data.tasks).map(task),
      schedules: arr(data.schedules).map(schedule),
      times: arr(data.times).map(times),
      completions: arr(data.completions).map(completion),
    },
    settings: settings(o.settings),
    weather: weatherCache(o.weather),
  };
}

/**
 * 저장된 문서나 백업 파일을 현재 형식으로 읽습니다.
 * 새 필드는 기본값으로 채우고, 모르는 필드는 버립니다.
 * `schemaVersion`이 앱보다 높으면 "future", 형식이 맞지 않으면 "corrupt"입니다.
 */
export function migrate(raw: unknown): MigrateResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, reason: "corrupt" };
  const o = raw as Obj;
  const version = o.schemaVersion;
  if (typeof version !== "number" || !isFinite(version)) return { ok: false, reason: "corrupt" };
  if (version > CURRENT_SCHEMA) return { ok: false, reason: "future" };
  if (version !== 1) return { ok: false, reason: "corrupt" };
  try {
    return { ok: true, doc: readV1(o) };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, reason: "corrupt" };
    throw e;
  }
}
