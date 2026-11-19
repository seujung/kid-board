import "fake-indexeddb/auto";
import { expect, test } from "vitest";
import type { DayDate } from "../../src/core/dayDate";
import type { BoardData } from "../../src/core/domain";
import type { WeatherSnapshot } from "../../src/core/weather";
import { BoardStore, InvalidPinError, StoreReadOnlyError } from "../../src/store/boardStore";
import { idbStorage } from "../../src/store/idb";
import { emptyDoc } from "../../src/store/schema";
import { defaultTimes, seedData } from "../../src/store/seed";
import { at } from "../support";
import { MemoryStorage, clock, counterID } from "./helpers";

const thu: DayDate = { year: 2026, month: 11, day: 19 };
const wed: DayDate = { year: 2026, month: 11, day: 18 };

async function makeStore(start = at(2026, 11, 18, 12)) {
  const storage = new MemoryStorage();
  const c = clock(start);
  const store = await BoardStore.open(storage, c.now, counterID());
  return { store, storage, clock: c };
}

/** 수요일에 시드를 넣고 목요일 07:00으로 시계를 옮깁니다. */
async function seeded() {
  const made = await makeStore();
  await made.store.seedIfNeeded();
  made.clock.set(at(2026, 11, 19, 7));
  return { ...made, data: made.store.snapshot() };
}

function morningTask(data: BoardData) {
  const child = data.children[0]!.id;
  const task = data.tasks.find((t) => t.childID === child && t.title === "세수하기")!.id;
  return { child, task };
}

let dbCounter = 0;
function freshDBName() {
  dbCounter += 1;
  return `kid-board-test-${dbCounter}`;
}

// MARK: seed

test("seedDataMatchesNativeSeed", () => {
  const data = seedData(wed, counterID());
  expect(data.children.map((c) => [c.name, c.avatar, c.themeColor, c.order])).toEqual([
    ["첫째", "🐰", "coral", 0],
    ["둘째", "🐻", "sky", 1],
  ]);
  const first = data.children[0]!.id;
  const tasks = data.tasks.filter((t) => t.childID === first).sort((a, b) => a.order - b.order);
  expect(tasks.map((t) => `${t.icon}${t.title}`)).toEqual([
    "🧼세수하기",
    "👕옷 입기",
    "🍚아침 먹기",
    "🪥양치하기",
    "🎒가방 챙기기",
    "📚숙제하기",
    "📖책 읽기",
    "✏️내일 준비물 챙기기",
    "🛁샤워하기",
  ]);
  const wash = data.schedules.find((s) => s.taskID === tasks[0]!.id)!;
  expect(wash).toMatchObject({ slot: "morning", weekdays: [1, 2, 3, 4, 5], startOn: wed, endOn: null });
  const shower = data.schedules.find((s) => s.taskID === tasks[8]!.id)!;
  expect(shower).toMatchObject({ slot: "evening", weekdays: [1, 2, 3, 4, 5, 6, 7], startOn: wed, endOn: null });
  expect(data.times.length).toBe(14);
  expect(data.completions).toEqual([]);
  expect(new Set(data.tasks.map((t) => t.id)).size).toBe(18);
});

test("seedCreatesTwoChildrenOnce", async () => {
  const { store } = await makeStore();
  await store.seedIfNeeded();
  await store.seedIfNeeded();
  const data = store.snapshot();
  expect(data.children.length).toBe(2);
  expect(data.tasks.length).toBe(18);
  expect(data.children.map((c) => c.name)).toEqual(["첫째", "둘째"]);
});

test("seedRunsOnlyOnceEvenAfterAllChildrenAreDeleted", async () => {
  const { store } = await makeStore();
  await store.seedIfNeeded();
  for (const child of store.snapshot().children) await store.deleteChild(child.id);
  await store.seedIfNeeded();
  expect(store.snapshot().children).toEqual([]);
  expect(store.settings().didSeed).toBe(true);
});

test("seedSkipsStoreThatAlreadyHasChildren", async () => {
  const { store } = await makeStore();
  await store.addChild("하나", "🐱", "mint");
  await store.seedIfNeeded();
  expect(store.snapshot().children.map((c) => c.name)).toEqual(["하나"]);
  expect(store.settings().didSeed).toBe(true);
});

test("openWithNoStoredDocIsEmptyAndNotSeeded", async () => {
  const { store, storage } = await makeStore();
  expect(store.status).toBe("ok");
  expect(store.snapshot().children).toEqual([]);
  expect(store.settings().didSeed).toBe(false);
  expect(storage.saves).toBe(0);
});

// MARK: children

test("addChildCreatesDefaultTimes", async () => {
  const { store } = await makeStore();
  const child = await store.addChild("하나", "🐱", "mint");
  const times = store.snapshot().times.filter((t) => t.childID === child);
  expect(times.length).toBe(7);
  for (const weekday of [1, 2, 3, 4, 5, 6, 7] as const) {
    const entry = times.find((t) => t.weekday === weekday)!;
    expect(entry.schoolTime).toEqual(weekday >= 6 ? null : { hour: 8, minute: 20 });
    expect(entry.bedTime).toEqual({ hour: 21, minute: 30 });
  }
  expect(times).toEqual(defaultTimes(child));
});

test("addChildAppendsOrder", async () => {
  const { store } = await makeStore();
  await store.addChild("하나", "🐱", "mint");
  await store.addChild("둘", "🐶", "sky");
  expect(store.snapshot().children.map((c) => [c.name, c.order])).toEqual([
    ["하나", 0],
    ["둘", 1],
  ]);
});

test("updateChildChangesFields", async () => {
  const { store } = await makeStore();
  const id = await store.addChild("하나", "🐱", "mint");
  await store.updateChild({ id, name: "하나야", avatar: "🦊", themeColor: "coral", order: 0 });
  expect(store.snapshot().children[0]).toEqual({ id, name: "하나야", avatar: "🦊", themeColor: "coral", order: 0 });
});

test("moveChildRewritesOrder", async () => {
  const { store } = await makeStore();
  const a = await store.addChild("A", "a", "mint");
  const b = await store.addChild("B", "b", "mint");
  const c = await store.addChild("C", "c", "mint");
  await store.moveChild(2, 0);
  expect(store.snapshot().children.map((x) => [x.id, x.order])).toEqual([
    [c, 0],
    [a, 1],
    [b, 2],
  ]);
});

test("deleteChildRemovesOwnedData", async () => {
  const { store, data } = await seeded();
  const first = data.children[0]!.id;
  const second = data.children[1]!.id;
  const task = data.tasks.find((t) => t.childID === first && t.title === "세수하기")!.id;
  expect(await store.toggleCompletion(first, task)).toBe(true);
  const other = data.tasks.find((t) => t.childID === second && t.title === "세수하기")!.id;
  expect(await store.toggleCompletion(second, other)).toBe(true);
  await store.deleteChild(first);
  const after = store.snapshot();
  expect(after.children.map((c) => c.id)).toEqual([second]);
  expect(after.tasks.every((t) => t.childID === second) && after.tasks.length === 9).toBe(true);
  expect(after.times.every((t) => t.childID === second) && after.times.length === 7).toBe(true);
  expect(after.completions.every((c) => c.childID === second) && after.completions.length === 1).toBe(true);
  expect(after.schedules.length).toBe(9);
});

// MARK: tasks

test("addTaskCreatesScheduleStartingToday", async () => {
  const { store } = await makeStore(at(2026, 11, 19, 7));
  const child = await store.addChild("하나", "🐱", "mint");
  const t1 = await store.addTask(child, "그림 그리기", "🎨", "evening", [6, 7]);
  const t2 = await store.addTask(child, "물 마시기", "💧", "morning", [1]);
  const data = store.snapshot();
  expect(data.tasks.find((t) => t.id === t1)).toMatchObject({ childID: child, order: 0, archivedOn: null });
  expect(data.tasks.find((t) => t.id === t2)).toMatchObject({ order: 1, createdAt: at(2026, 11, 19, 7).getTime() });
  expect(data.schedules.find((s) => s.taskID === t1)).toMatchObject({
    slot: "evening",
    weekdays: [6, 7],
    startOn: thu,
    endOn: null,
  });
});

test("updateTaskAppearanceChangesTitleAndIcon", async () => {
  const { store, data } = await seeded();
  const { task } = morningTask(data);
  await store.updateTaskAppearance(task, "얼굴 씻기", "🫧");
  expect(store.snapshot().tasks.find((t) => t.id === task)).toMatchObject({ title: "얼굴 씻기", icon: "🫧" });
});

test("updateScheduleSplits", async () => {
  const { store, data } = await seeded();
  const { task } = morningTask(data);
  expect(store.snapshot().schedules.filter((s) => s.taskID === task).length).toBe(1);
  await store.updateTaskSchedule(task, "morning", [1]);
  const schedules = store.snapshot().schedules.filter((s) => s.taskID === task);
  expect(schedules.length).toBe(2);
  expect(schedules.some((s) => s.endOn !== null && s.endOn.day === wed.day && s.endOn.month === wed.month)).toBe(true);
  expect(schedules.some((s) => s.startOn.day === thu.day && s.weekdays.join() === "1")).toBe(true);
});

test("archiveTaskSetsTodayAndKeepsCompletions", async () => {
  const { store, data } = await seeded();
  const { child, task } = morningTask(data);
  expect(await store.toggleCompletion(child, task)).toBe(true);
  await store.archiveTask(task);
  const after = store.snapshot();
  expect(after.tasks.find((t) => t.id === task)!.archivedOn).toEqual(thu);
  expect(after.completions.length).toBe(1);
});

test("moveTaskReordersWithinSlot", async () => {
  const { store, data } = await seeded();
  const child = data.children[0]!.id;
  const morningTitles = () =>
    store
      .snapshot()
      .tasks.filter((t) => t.childID === child && t.order < 5)
      .sort((a, b) => a.order - b.order)
      .map((t) => t.title);
  await store.moveTask(child, "morning", 4, 0);
  expect(morningTitles()).toEqual(["가방 챙기기", "세수하기", "옷 입기", "아침 먹기", "양치하기"]);
  const evening = store
    .snapshot()
    .tasks.filter((t) => t.childID === child && t.order >= 5)
    .sort((a, b) => a.order - b.order)
    .map((t) => t.title);
  expect(evening).toEqual(["숙제하기", "책 읽기", "내일 준비물 챙기기", "샤워하기"]);
});

test("copyTaskToOtherChild", async () => {
  const { store, data } = await seeded();
  const first = data.children[0]!.id;
  const second = data.children[1]!.id;
  const source = data.tasks.find((t) => t.childID === first && t.title === "숙제하기")!;
  const newID = await store.copyTask(source.id, second);
  expect(newID).not.toBeNull();
  const after = store.snapshot();
  const copy = after.tasks.find((t) => t.id === newID)!;
  expect(copy.childID).toBe(second);
  expect(copy.title === source.title && copy.icon === source.icon).toBe(true);
  const a = after.schedules.find((s) => s.taskID === source.id)!;
  const b = after.schedules.find((s) => s.taskID === newID)!;
  expect(a.slot).toBe(b.slot);
  expect(a.weekdays).toEqual(b.weekdays);
  expect(b.startOn).toEqual(thu);
});

test("copyMissingTaskReturnsNull", async () => {
  const { store, storage, data } = await seeded();
  const saves = storage.saves;
  expect(await store.copyTask("nope", data.children[0]!.id)).toBeNull();
  expect(storage.saves).toBe(saves);
});

// MARK: times

test("setTimesReplacesEntry", async () => {
  const { store } = await makeStore();
  const child = await store.addChild("하나", "🐱", "mint");
  await store.setTimes(child, 1, null, { hour: 20, minute: 45 });
  const times = store.snapshot().times.filter((t) => t.childID === child);
  expect(times.length).toBe(7);
  expect(times.find((t) => t.weekday === 1)).toEqual({ childID: child, weekday: 1, schoolTime: null, bedTime: { hour: 20, minute: 45 } });
});

// MARK: completion

test("snapshotIsCachedUntilAMutation", async () => {
  const { store, data } = await seeded();
  expect(store.snapshot()).toBe(data);
  expect(store.snapshot()).toBe(data);
  const { child, task } = morningTask(data);
  expect(await store.toggleCompletion(child, task)).toBe(true);
  const next = store.snapshot();
  expect(next).not.toBe(data);
  expect(next.completions.length).toBe(1);
  expect(store.snapshot()).toBe(next);
});

test("toggleCreatesAndRemovesCompletion", async () => {
  const { store, data, clock: c } = await seeded();
  const { child, task } = morningTask(data);
  expect(await store.toggleCompletion(child, task)).toBe(true);
  expect(store.snapshot().completions).toEqual([
    { childID: child, taskID: task, day: thu, completedAt: at(2026, 11, 19, 7).getTime() },
  ]);
  c.set(at(2026, 11, 19, 7, 5));
  expect(await store.toggleCompletion(child, task)).toBe(true);
  expect(store.snapshot().completions.length).toBe(0);
});

test("toggleRejectedAfterDeadline", async () => {
  const { store, storage, data, clock: c } = await seeded();
  const { child, task } = morningTask(data);
  c.set(at(2026, 11, 19, 8, 30));
  const saves = storage.saves;
  expect(await store.toggleCompletion(child, task)).toBe(false);
  expect(store.snapshot().completions.length).toBe(0);
  expect(storage.saves).toBe(saves);
});

test("doubleToggleKeepsAtMostOne", async () => {
  const { store, data, clock: c } = await seeded();
  const { child, task } = morningTask(data);
  expect(await store.toggleCompletion(child, task)).toBe(true);
  expect(store.snapshot().completions.length).toBe(1);
  c.set(at(2026, 11, 19, 7, 1));
  expect(await store.toggleCompletion(child, task)).toBe(true);
  expect(store.snapshot().completions).toEqual([]);
});

test("mutationsNotifyObservers", async () => {
  const { store, storage, clock: c } = await makeStore();
  let count = 0;
  const unsubscribe = store.subscribe(() => {
    count += 1;
  });

  await store.seedIfNeeded();
  expect(count).toBe(1);
  expect(storage.saves).toBe(1);
  await store.seedIfNeeded();
  expect(count).toBe(1);
  expect(storage.saves).toBe(1);

  c.set(at(2026, 11, 19, 7));
  const { child, task } = morningTask(store.snapshot());
  expect(await store.toggleCompletion(child, task)).toBe(true);
  expect(count).toBe(2);
  c.set(at(2026, 11, 19, 8, 30));
  expect(await store.toggleCompletion(child, task)).toBe(false);
  expect(count).toBe(2);

  unsubscribe();
  await store.addChild("하나", "🐱", "mint");
  expect(count).toBe(2);
});

test("notifyFiresBeforeSaveCompletesAndSavesStayOrdered", async () => {
  const order: string[] = [];
  const resolvers: Array<() => void> = [];
  const saved: number[] = [];
  const storage = {
    async load() {
      return null;
    },
    save(doc: { data: BoardData }) {
      const n = doc.data.children.length;
      order.push(`save-start-${n}`);
      return new Promise<void>((resolve) => {
        resolvers.push(() => {
          saved.push(n);
          resolve();
        });
      });
    },
  };
  const store = await BoardStore.open(storage, () => at(2026, 11, 19, 7), counterID());
  store.subscribe(() => order.push(`notify-${store.snapshot().children.length}`));
  const p1 = store.addChild("A", "a", "mint");
  const p2 = store.addChild("B", "b", "mint");
  await Promise.resolve();
  await Promise.resolve();
  // 두 변경 모두 저장이 끝나기 전에 알립니다.
  expect(saved).toEqual([]);
  expect(order.indexOf("notify-1")).toBeGreaterThanOrEqual(0);
  expect(order.indexOf("notify-2")).toBeGreaterThanOrEqual(0);
  // 두 번째 저장은 첫 번째 저장이 끝나기 전에 시작하지 않습니다.
  expect(order.indexOf("save-start-2")).toBe(-1);
  resolvers.shift()!();
  await p1;
  for (let i = 0; i < 5 && resolvers.length === 0; i++) await Promise.resolve();
  resolvers.shift()!();
  await p2;
  expect(saved).toEqual([1, 2]);
});

// MARK: read-only

test("corruptDocOpensReadOnlyAndIsNotOverwritten", async () => {
  const storage = new MemoryStorage("garbage");
  const store = await BoardStore.open(storage, () => at(2026, 11, 19, 7), counterID());
  expect(store.status).toBe("readOnlyError");
  await expect(store.addChild("하나", "🐱", "mint")).rejects.toBeInstanceOf(StoreReadOnlyError);
  await expect(store.seedIfNeeded()).rejects.toBeInstanceOf(StoreReadOnlyError);
  expect(storage.saves).toBe(0);
  expect(storage.stored).toBe("garbage");
  expect(store.snapshot().children).toEqual([]);
});

test("futureSchemaOpensReadOnly", async () => {
  const future = { ...emptyDoc(), schemaVersion: 99 };
  const storage = new MemoryStorage(future);
  const store = await BoardStore.open(storage, () => at(2026, 11, 19, 7), counterID());
  expect(store.status).toBe("readOnlyError");
  await expect(store.setPin("1234")).rejects.toBeInstanceOf(StoreReadOnlyError);
  expect(storage.saves).toBe(0);
});

test("loadFailureOpensReadOnly", async () => {
  let saves = 0;
  const storage = {
    async load(): Promise<unknown> {
      throw new Error("boom");
    },
    async save() {
      saves += 1;
    },
  };
  const store = await BoardStore.open(storage, () => at(2026, 11, 19, 7), counterID());
  expect(store.status).toBe("readOnlyError");
  await expect(store.markBackedUp()).rejects.toBeInstanceOf(StoreReadOnlyError);
  expect(saves).toBe(0);
});

test("reopenRestoresSavedDoc", async () => {
  const storage = new MemoryStorage();
  const store = await BoardStore.open(storage, () => at(2026, 11, 18, 12), counterID());
  await store.seedIfNeeded();
  const reopened = await BoardStore.open(storage, () => at(2026, 11, 18, 12), counterID("x"));
  expect(reopened.status).toBe("ok");
  expect(reopened.snapshot()).toEqual(store.snapshot());
  expect(reopened.settings().didSeed).toBe(true);
});

// MARK: PIN

test("pinSetAndVerify", async () => {
  const { store } = await makeStore(at(2026, 11, 19, 7));
  expect(store.hasPin).toBe(false);
  await store.setPin("1234");
  expect(store.hasPin).toBe(true);
  expect(await store.verifyPin("1234")).toBe("ok");
  expect(await store.verifyPin("0000")).toBe("wrong");
});

test("setPinRejectsInvalidPin", async () => {
  const { store, storage } = await makeStore();
  await expect(store.setPin("12a4")).rejects.toThrow();
  expect(store.hasPin).toBe(false);
  expect(storage.saves).toBe(0);
});

test("pinLocksAfterFive", async () => {
  const { store, clock: c } = await makeStore(at(2026, 11, 19, 7));
  await store.setPin("1234");
  const start = at(2026, 11, 19, 7).getTime();
  for (let attempt = 0; attempt < 4; attempt++) {
    c.set(new Date(start + attempt * 1000));
    expect(await store.verifyPin("0000")).toBe("wrong");
  }
  const fifth = start + 4000;
  c.set(new Date(fifth));
  expect(await store.verifyPin("0000")).toEqual({ lockedUntil: fifth + 60000 });
  c.set(new Date(fifth + 30000));
  expect(await store.verifyPin("1234")).toEqual({ lockedUntil: fifth + 60000 });
  c.set(new Date(fifth + 61000));
  expect(await store.verifyPin("1234")).toBe("ok");
});

test("pinLockoutPersistsAcrossStores", async () => {
  const storage = idbStorage(freshDBName());
  const start = at(2026, 11, 19, 7);
  const store = await BoardStore.open(storage, () => start, counterID());
  await store.setPin("1234");
  for (let i = 0; i < 5; i++) await store.verifyPin("0000");
  const reopened = await BoardStore.open(storage, () => new Date(start.getTime() + 10000), counterID());
  expect(await reopened.verifyPin("1234")).toEqual({ lockedUntil: start.getTime() + 60000 });
});

test("setPinReturnsRecoveryCodeThatResetsPin", async () => {
  const { store } = await makeStore(at(2026, 11, 19, 7));
  const code = await store.setPin("1234");
  expect(code).toMatch(/^[0-9]{8}$/);
  expect(await store.verifyRecoveryCode(code)).toBe("ok");
  // 복구 코드가 맞으면 새 PIN을 정합니다.
  await store.setPin("5678");
  expect(await store.verifyPin("5678")).toBe("ok");
  expect(await store.verifyPin("1234")).toBe("wrong");
});

test("changePinKeepsRecoveryCode", async () => {
  const { store } = await makeStore(at(2026, 11, 19, 7));
  const code = await store.setPin("1234");
  for (let i = 0; i < 3; i++) await store.verifyPin("0000");
  await store.changePin("5678");
  expect(await store.verifyPin("5678")).toBe("ok");
  expect(await store.verifyPin("1234")).toBe("wrong");
  // 복구 코드는 그대로 씁니다(웹 설계 6.10.4).
  expect(await store.verifyRecoveryCode(code)).toBe("ok");
});

test("changePinResetsPinLockout", async () => {
  const { store } = await makeStore(at(2026, 11, 19, 7));
  await store.setPin("1234");
  for (let i = 0; i < 5; i++) await store.verifyPin("0000");
  expect(store.settings().lockout.lockedUntil).not.toBeNull();
  await store.changePin("5678");
  expect(store.settings().lockout).toEqual({ failures: 0, lockedUntil: null });
  expect(await store.verifyPin("5678")).toBe("ok");
});

test("changePinRejectsInvalidPin", async () => {
  const { store } = await makeStore(at(2026, 11, 19, 7));
  await store.setPin("1234");
  await expect(store.changePin("12")).rejects.toThrow(InvalidPinError);
  expect(await store.verifyPin("1234")).toBe("ok");
});

test("recoveryCodeSuccessKeepsCode", async () => {
  const { store } = await makeStore(at(2026, 11, 19, 7));
  const code = await store.setPin("1234");
  expect(await store.verifyRecoveryCode(code)).toBe("ok");
  expect(await store.verifyRecoveryCode(code)).toBe("ok");
});

test("recoveryCodeLocksAfterFive", async () => {
  const { store } = await makeStore(at(2026, 11, 19, 7));
  const code = await store.setPin("1234");
  const wrong = code === "00000000" ? "11111111" : "00000000";
  for (let i = 0; i < 4; i++) expect(await store.verifyRecoveryCode(wrong)).toBe("wrong");
  const until = at(2026, 11, 19, 7).getTime() + 60000;
  expect(await store.verifyRecoveryCode(wrong)).toEqual({ lockedUntil: until });
  expect(await store.verifyRecoveryCode(code)).toEqual({ lockedUntil: until });
  // PIN 잠금과는 따로 셉니다.
  expect(await store.verifyPin("1234")).toBe("ok");
});

test("regenerateInvalidatesOldCode", async () => {
  const { store } = await makeStore(at(2026, 11, 19, 7));
  const old = await store.setPin("1234");
  let fresh = await store.regenerateRecoveryCode();
  while (fresh === old) fresh = await store.regenerateRecoveryCode();
  expect(await store.verifyRecoveryCode(old)).toBe("wrong");
  expect(await store.verifyRecoveryCode(fresh)).toBe("ok");
  expect(await store.verifyPin("1234")).toBe("ok");
});

// MARK: location and weather

const seongnam = { name: "성남시", admin1: "경기도", latitude: 37.42, longitude: 127.13 };
const snap: WeatherSnapshot = {
  temperature: 12,
  weatherCode: 3,
  high: 15,
  low: 5,
  precipitationProbability: 40,
  fetchedAt: at(2026, 11, 19, 6).getTime(),
};

test("weatherLocationPersists", async () => {
  const storage = idbStorage(freshDBName());
  const store = await BoardStore.open(storage, () => at(2026, 11, 19, 7), counterID());
  expect(store.settings().location).toBeNull();
  await store.setLocation(seongnam);
  const reopened = await BoardStore.open(storage, () => at(2026, 11, 19, 7), counterID());
  expect(reopened.settings().location).toEqual(seongnam);
});

test("setLocationClearsWeatherCache", async () => {
  const { store } = await makeStore();
  let count = 0;
  store.subscribe(() => {
    count += 1;
  });
  await store.setWeather(snap);
  expect(store.weather()).toEqual(snap);
  await store.setLocation(seongnam);
  expect(store.weather()).toBeNull();
  expect(store.settings().location).toEqual(seongnam);
  expect(count).toBe(2);
});

test("markBackedUpStoresNow", async () => {
  const { store } = await makeStore(at(2026, 11, 19, 7));
  expect(store.settings().lastBackupAt).toBeNull();
  await store.markBackedUp();
  expect(store.settings().lastBackupAt).toBe(at(2026, 11, 19, 7).getTime());
});

test("setDimPeriodsPersistsAndCopies", async () => {
  const storage = idbStorage(freshDBName());
  const store = await BoardStore.open(storage, () => at(2026, 11, 19, 7), counterID());
  expect(store.settings().dimPeriods).toEqual(emptyDoc().settings.dimPeriods);
  let count = 0;
  store.subscribe(() => {
    count += 1;
  });
  const periods = [
    { id: "a", start: { hour: 9, minute: 0 }, end: { hour: 14, minute: 0 }, weekdays: [1, 2, 3, 4, 5] as (1 | 2 | 3 | 4 | 5)[] },
  ];
  await store.setDimPeriods(periods);
  expect(count).toBe(1);
  periods[0]!.weekdays.push(5);
  periods[0]!.start.hour = 1;
  expect(store.settings().dimPeriods).toEqual([
    { id: "a", start: { hour: 9, minute: 0 }, end: { hour: 14, minute: 0 }, weekdays: [1, 2, 3, 4, 5] },
  ]);
  const reopened = await BoardStore.open(storage, () => at(2026, 11, 19, 7), counterID());
  expect(reopened.settings().dimPeriods).toEqual(store.settings().dimPeriods);
  await store.setDimPeriods([]);
  expect(store.settings().dimPeriods).toEqual([]);
});

// MARK: idb

test("idbStorageRoundTrips", async () => {
  const storage = idbStorage(freshDBName());
  expect(await storage.load()).toBeNull();
  const doc = emptyDoc();
  doc.settings.didSeed = true;
  await storage.save(doc);
  await storage.save({ ...doc, weather: snap });
  expect(await storage.load()).toEqual({ ...doc, weather: snap });
});
