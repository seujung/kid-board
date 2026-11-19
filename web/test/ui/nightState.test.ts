import { expect, test } from "vitest";
import { NIGHT_WAKE_MS } from "../../src/core/displayPolicy";
import { nightState } from "../../src/ui/display/nightState";
import { at } from "../support";

const idle = { wakeUntil: null };

test("dimsAt22AndWakesFor30s", () => {
  expect(nightState(idle, at(2026, 11, 19, 21, 59, 59), false, false).dimmed).toBe(false);
  const dim = nightState(idle, at(2026, 11, 19, 22, 0), false, false);
  expect(dim).toEqual({ dimmed: true, wakeUntil: null });
  const woke = nightState(dim, at(2026, 11, 19, 22, 0), true, false);
  expect(woke).toEqual({ dimmed: false, wakeUntil: at(2026, 11, 19, 22, 0).getTime() + NIGHT_WAKE_MS });
  expect(nightState(woke, at(2026, 11, 19, 22, 0, 29), false, false).dimmed).toBe(false);
  expect(nightState(woke, at(2026, 11, 19, 22, 0, 30), false, false)).toEqual({ dimmed: true, wakeUntil: null });
});

test("touchDuringWakeExtends", () => {
  const woke = nightState(idle, at(2026, 11, 19, 22, 0), true, false);
  const extended = nightState(woke, at(2026, 11, 19, 22, 0, 20), true, false);
  expect(extended).toEqual({ dimmed: false, wakeUntil: at(2026, 11, 19, 22, 0, 50).getTime() });
  expect(nightState(extended, at(2026, 11, 19, 22, 0, 40), false, false).dimmed).toBe(false);
  expect(nightState(extended, at(2026, 11, 19, 22, 0, 50), false, false).dimmed).toBe(true);
});

test("parentOpenNeverDims", () => {
  expect(nightState(idle, at(2026, 11, 19, 23, 0), false, true).dimmed).toBe(false);
  expect(nightState(idle, at(2026, 11, 20, 3, 0), true, true).dimmed).toBe(false);
  // 부모 모드를 닫으면 바로 다시 어두워집니다.
  const afterParent = nightState(nightState(idle, at(2026, 11, 19, 23, 0), false, true), at(2026, 11, 19, 23, 0, 1), false, false);
  expect(afterParent.dimmed).toBe(true);
});

test("undimsAt06", () => {
  const dim = nightState(idle, at(2026, 11, 20, 5, 59, 59), false, false);
  expect(dim.dimmed).toBe(true);
  expect(nightState(dim, at(2026, 11, 20, 6, 0), false, false)).toEqual({ dimmed: false, wakeUntil: null });
  // 낮에는 터치해도 깨움 시각을 두지 않습니다.
  expect(nightState(idle, at(2026, 11, 20, 12, 0), true, false)).toEqual({ dimmed: false, wakeUntil: null });
});
