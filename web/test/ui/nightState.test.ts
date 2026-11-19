import { expect, test } from "vitest";
import { DEFAULT_DIM_PERIODS, NIGHT_WAKE_MS } from "../../src/core/displayPolicy";
import type { DimPeriod } from "../../src/core/displayPolicy";
import { nightState } from "../../src/ui/display/nightState";
import { at } from "../support";

const idle = { wakeUntil: null };

test("dimsAt22AndWakesFor30s", () => {
  expect(nightState(idle, at(2026, 11, 19, 21, 59, 59), false, false, DEFAULT_DIM_PERIODS).dimmed).toBe(false);
  const dim = nightState(idle, at(2026, 11, 19, 22, 0), false, false, DEFAULT_DIM_PERIODS);
  expect(dim).toEqual({ dimmed: true, wakeUntil: null });
  const woke = nightState(dim, at(2026, 11, 19, 22, 0), true, false, DEFAULT_DIM_PERIODS);
  expect(woke).toEqual({ dimmed: false, wakeUntil: at(2026, 11, 19, 22, 0).getTime() + NIGHT_WAKE_MS });
  expect(nightState(woke, at(2026, 11, 19, 22, 0, 29), false, false, DEFAULT_DIM_PERIODS).dimmed).toBe(false);
  expect(nightState(woke, at(2026, 11, 19, 22, 0, 30), false, false, DEFAULT_DIM_PERIODS)).toEqual({ dimmed: true, wakeUntil: null });
});

test("touchDuringWakeExtends", () => {
  const woke = nightState(idle, at(2026, 11, 19, 22, 0), true, false, DEFAULT_DIM_PERIODS);
  const extended = nightState(woke, at(2026, 11, 19, 22, 0, 20), true, false, DEFAULT_DIM_PERIODS);
  expect(extended).toEqual({ dimmed: false, wakeUntil: at(2026, 11, 19, 22, 0, 50).getTime() });
  expect(nightState(extended, at(2026, 11, 19, 22, 0, 40), false, false, DEFAULT_DIM_PERIODS).dimmed).toBe(false);
  expect(nightState(extended, at(2026, 11, 19, 22, 0, 50), false, false, DEFAULT_DIM_PERIODS).dimmed).toBe(true);
});

test("parentOpenNeverDims", () => {
  expect(nightState(idle, at(2026, 11, 19, 23, 0), false, true, DEFAULT_DIM_PERIODS).dimmed).toBe(false);
  expect(nightState(idle, at(2026, 11, 20, 3, 0), true, true, DEFAULT_DIM_PERIODS).dimmed).toBe(false);
  // 부모 모드를 닫으면 바로 다시 어두워집니다.
  const afterParent = nightState(nightState(idle, at(2026, 11, 19, 23, 0), false, true, DEFAULT_DIM_PERIODS), at(2026, 11, 19, 23, 0, 1), false, false, DEFAULT_DIM_PERIODS);
  expect(afterParent.dimmed).toBe(true);
});

test("undimsAt06", () => {
  const dim = nightState(idle, at(2026, 11, 20, 5, 59, 59), false, false, DEFAULT_DIM_PERIODS);
  expect(dim.dimmed).toBe(true);
  expect(nightState(dim, at(2026, 11, 20, 6, 0), false, false, DEFAULT_DIM_PERIODS)).toEqual({ dimmed: false, wakeUntil: null });
  // 낮에는 터치해도 깨움 시각을 두지 않습니다.
  expect(nightState(idle, at(2026, 11, 20, 12, 0), true, false, DEFAULT_DIM_PERIODS)).toEqual({ dimmed: false, wakeUntil: null });
});

test("followsUserPeriods", () => {
  // 평일 09:00~14:00만 어둡게 합니다.
  const school: DimPeriod[] = [{ id: "s", start: { hour: 9, minute: 0 }, end: { hour: 14, minute: 0 }, weekdays: [1, 2, 3, 4, 5] }];
  expect(nightState(idle, at(2026, 11, 19, 8, 59), false, false, school).dimmed).toBe(false);
  const dim = nightState(idle, at(2026, 11, 19, 9, 0), false, false, school);
  expect(dim).toEqual({ dimmed: true, wakeUntil: null });
  const woke = nightState(dim, at(2026, 11, 19, 10, 0), true, false, school);
  expect(woke).toEqual({ dimmed: false, wakeUntil: at(2026, 11, 19, 10, 0, 30).getTime() });
  expect(nightState(woke, at(2026, 11, 19, 10, 0, 30), false, false, school).dimmed).toBe(true);
  expect(nightState(idle, at(2026, 11, 19, 10, 0), false, true, school).dimmed).toBe(false);
  expect(nightState(idle, at(2026, 11, 19, 14, 0), false, false, school).dimmed).toBe(false);
  // 기본 밤 구간이 없으므로 밤에도 켜져 있습니다.
  expect(nightState(idle, at(2026, 11, 19, 23, 0), false, false, school).dimmed).toBe(false);
  expect(nightState(idle, at(2026, 11, 22, 10, 0), false, false, school).dimmed).toBe(false);
  expect(nightState(idle, at(2026, 11, 19, 23, 0), false, false, []).dimmed).toBe(false);
});
