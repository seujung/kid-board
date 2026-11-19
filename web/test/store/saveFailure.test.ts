import { expect, test } from "vitest";
import type { BoardData } from "../../src/core/domain";
import { BoardStore } from "../../src/store/boardStore";
import type { AppDoc } from "../../src/store/schema";
import { at } from "../support";
import { FlakyStorage, clock, counterID } from "./helpers";

/** 수요일에 시드를 넣고 목요일 07:00으로 시계를 옮깁니다. */
async function seeded() {
  const storage = new FlakyStorage();
  const c = clock(at(2026, 11, 18, 12));
  const store = await BoardStore.open(storage, c.now, counterID());
  await store.seedIfNeeded();
  c.set(at(2026, 11, 19, 7));
  return { store, storage, clock: c };
}

function morningTask(data: BoardData) {
  const child = data.children[0]!.id;
  const task = data.tasks.find((t) => t.childID === child && t.title === "세수하기")!.id;
  return { child, task };
}

test("failedSaveRollsBackMemoryAndNotifies", async () => {
  const { store, storage } = await seeded();
  const { child, task } = morningTask(store.snapshot());
  let notified = 0;
  store.subscribe(() => {
    notified += 1;
  });
  storage.failNext = 1;
  await expect(store.toggleCompletion(child, task)).rejects.toThrow("save failed");
  // 디스크에 없는 완료 기록이 메모리에 남지 않습니다.
  expect(store.snapshot().completions).toEqual([]);
  expect(notified).toBe(2);
  // 다시 누르면 완료됩니다.
  expect(await store.toggleCompletion(child, task)).toBe(true);
  expect(store.snapshot().completions.length).toBe(1);
  expect((storage.stored as AppDoc).data.completions.length).toBe(1);
});

test("failedSaveKeepsMemoryWhenNewerCommitIsQueued", async () => {
  const rejects: Array<(err: Error) => void> = [];
  const resolves: Array<() => void> = [];
  let stored: AppDoc | null = null;
  const storage = {
    async load() {
      return null;
    },
    save(doc: AppDoc) {
      return new Promise<void>((resolve, reject) => {
        resolves.push(() => {
          stored = doc;
          resolve();
        });
        rejects.push(reject);
      });
    },
  };
  const store = await BoardStore.open(storage, () => at(2026, 11, 19, 7), counterID());
  const a = store.addChild("A", "a", "mint");
  const b = store.addChild("B", "b", "mint");
  await Promise.resolve();
  // A의 저장이 실패해도 B의 저장이 A+B 전체 문서를 씁니다.
  rejects[0]!(new Error("A failed"));
  await expect(a).rejects.toThrow("A failed");
  expect(store.snapshot().children.map((c) => c.name)).toEqual(["A", "B"]);
  for (let i = 0; i < 5 && resolves.length < 2; i++) await Promise.resolve();
  resolves[1]!();
  await b;
  expect(stored!.data.children.map((c) => c.name)).toEqual(["A", "B"]);
  expect(store.snapshot().children.map((c) => c.name)).toEqual(["A", "B"]);
});

test("failedSaveRollsBackToLastPersistedDoc", async () => {
  const { store, storage } = await seeded();
  storage.failing = true;
  // 두 변경이 모두 실패하면 처음 저장된 문서로 돌아갑니다.
  const a = store.addChild("A", "a", "mint");
  const b = store.addChild("B", "b", "mint");
  await expect(a).rejects.toThrow();
  await expect(b).rejects.toThrow();
  expect(store.snapshot().children.map((c) => c.name)).toEqual(["첫째", "둘째"]);
});

test("failedSetPinLeavesNoPin", async () => {
  const { store, storage } = await seeded();
  storage.failNext = 1;
  await expect(store.setPin("1234")).rejects.toThrow();
  expect(store.hasPin).toBe(false);
  expect(store.settings().recoveryHash).toBeNull();
  expect(await store.verifyPin("1234")).toBe("wrong");
});

test("rollbackNeverRestoresLockoutCounters", async () => {
  const { store, storage, clock: c } = await seeded();
  await store.setPin("1234");
  storage.failing = true;
  const start = at(2026, 11, 19, 7).getTime();
  for (let i = 0; i < 4; i++) {
    c.set(new Date(start + i * 1000));
    expect(await store.verifyPin("0000")).toBe("wrong");
  }
  c.set(new Date(start + 4000));
  // 저장이 실패해도 틀린 횟수는 메모리에 남아 잠깁니다.
  expect(await store.verifyPin("0000")).toEqual({ lockedUntil: start + 64000 });
  // 다른 변경의 되돌림도 잠금을 풀지 않습니다.
  await expect(store.addChild("A", "a", "mint")).rejects.toThrow();
  expect(store.settings().lockout.lockedUntil).toBe(start + 64000);
  expect(await store.verifyPin("1234")).toEqual({ lockedUntil: start + 64000 });
});

test("correctPinAcceptedWhenLockoutResetSaveFails", async () => {
  const { store, storage } = await seeded();
  const code = await store.setPin("1234");
  expect(await store.verifyPin("0000")).toBe("wrong");
  expect(await store.verifyRecoveryCode("00000000")).toBe("wrong");
  storage.failing = true;
  expect(await store.verifyPin("1234")).toBe("ok");
  expect(store.settings().lockout).toEqual({ failures: 0, lockedUntil: null });
  expect(await store.verifyRecoveryCode(code)).toBe("ok");
  expect(store.settings().recoveryLockout).toEqual({ failures: 0, lockedUntil: null });
});

test("correctPinWithNoFailuresDoesNotSave", async () => {
  const { store, storage } = await seeded();
  await store.setPin("1234");
  const saves = storage.saves;
  expect(await store.verifyPin("1234")).toBe("ok");
  expect(storage.saves).toBe(saves);
});
