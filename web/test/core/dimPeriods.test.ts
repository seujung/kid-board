import { expect, test } from "vitest";
import { DEFAULT_DIM_PERIODS, isDimmed } from "../../src/core/displayPolicy";
import type { DimPeriod } from "../../src/core/displayPolicy";
import { at } from "../support";

// 2026-11-16은 월요일, 2026-11-19는 목요일, 2026-11-22는 일요일입니다.
function period(start: string, end: string, weekdays: DimPeriod["weekdays"], id = "p"): DimPeriod {
  const t = (s: string) => ({ hour: Number(s.slice(0, 2)), minute: Number(s.slice(3, 5)) });
  return { id, start: t(start), end: t(end), weekdays };
}

test("defaultIsEveryNight22To06", () => {
  expect(DEFAULT_DIM_PERIODS).toEqual([
    { id: "default-night", start: { hour: 22, minute: 0 }, end: { hour: 6, minute: 0 }, weekdays: [1, 2, 3, 4, 5, 6, 7] },
  ]);
  expect(isDimmed(at(2026, 11, 19, 21, 59, 59), DEFAULT_DIM_PERIODS)).toBe(false);
  expect(isDimmed(at(2026, 11, 19, 22, 0), DEFAULT_DIM_PERIODS)).toBe(true);
  expect(isDimmed(at(2026, 11, 20, 5, 59, 59), DEFAULT_DIM_PERIODS)).toBe(true);
  expect(isDimmed(at(2026, 11, 20, 6, 0), DEFAULT_DIM_PERIODS)).toBe(false);
  expect(isDimmed(at(2026, 11, 20, 12, 0), DEFAULT_DIM_PERIODS)).toBe(false);
});

test("crossMidnightBelongsToStartDay", () => {
  const mon = [period("22:00", "06:00", [1])];
  expect(isDimmed(at(2026, 11, 16, 21, 59), mon)).toBe(false);
  expect(isDimmed(at(2026, 11, 16, 22, 0), mon)).toBe(true);
  expect(isDimmed(at(2026, 11, 16, 23, 59), mon)).toBe(true);
  // 화요일 새벽은 월요일 구간에 속합니다.
  expect(isDimmed(at(2026, 11, 17, 0, 0), mon)).toBe(true);
  expect(isDimmed(at(2026, 11, 17, 5, 59), mon)).toBe(true);
  expect(isDimmed(at(2026, 11, 17, 6, 0), mon)).toBe(false);
  // 화요일 밤은 월요일 구간이 아닙니다.
  expect(isDimmed(at(2026, 11, 17, 22, 0), mon)).toBe(false);
  // 월요일 새벽은 일요일에 시작한 구간이 있어야 어둡습니다.
  expect(isDimmed(at(2026, 11, 16, 3, 0), mon)).toBe(false);
  // 일요일 밤 구간은 월요일 새벽까지 이어집니다.
  const sun = [period("23:00", "07:00", [7])];
  expect(isDimmed(at(2026, 11, 23, 6, 59), sun)).toBe(true);
  expect(isDimmed(at(2026, 11, 23, 7, 0), sun)).toBe(false);
});

test("weekdayFilter", () => {
  const school = [period("09:00", "14:00", [1, 2, 3, 4, 5])];
  expect(isDimmed(at(2026, 11, 16, 10, 0), school)).toBe(true);
  expect(isDimmed(at(2026, 11, 20, 13, 59), school)).toBe(true);
  expect(isDimmed(at(2026, 11, 21, 10, 0), school)).toBe(false);
  expect(isDimmed(at(2026, 11, 22, 10, 0), school)).toBe(false);
  expect(isDimmed(at(2026, 11, 16, 8, 59), school)).toBe(false);
  expect(isDimmed(at(2026, 11, 16, 14, 0), school)).toBe(false);
});

test("severalPeriods", () => {
  const periods = [period("22:00", "06:00", [1, 2, 3, 4, 5, 6, 7], "a"), period("09:00", "14:00", [1, 2, 3, 4, 5], "b")];
  expect(isDimmed(at(2026, 11, 19, 23, 0), periods)).toBe(true);
  expect(isDimmed(at(2026, 11, 19, 10, 0), periods)).toBe(true);
  expect(isDimmed(at(2026, 11, 19, 15, 0), periods)).toBe(false);
  expect(isDimmed(at(2026, 11, 21, 10, 0), periods)).toBe(false);
  expect(isDimmed(at(2026, 11, 21, 3, 0), periods)).toBe(true);
});

test("emptyListNeverDims", () => {
  for (let h = 0; h < 24; h++) expect(isDimmed(at(2026, 11, 19, h, 30), [])).toBe(false);
});

test("startEqualsEndIsTwentyFourHours", () => {
  const thu = [period("08:00", "08:00", [4])];
  expect(isDimmed(at(2026, 11, 19, 7, 59), thu)).toBe(false);
  expect(isDimmed(at(2026, 11, 19, 8, 0), thu)).toBe(true);
  expect(isDimmed(at(2026, 11, 19, 20, 0), thu)).toBe(true);
  expect(isDimmed(at(2026, 11, 20, 7, 59), thu)).toBe(true);
  expect(isDimmed(at(2026, 11, 20, 8, 0), thu)).toBe(false);
  const midnight = [period("00:00", "00:00", [4])];
  expect(isDimmed(at(2026, 11, 19, 0, 0), midnight)).toBe(true);
  expect(isDimmed(at(2026, 11, 19, 23, 59, 59), midnight)).toBe(true);
  expect(isDimmed(at(2026, 11, 20, 0, 0), midnight)).toBe(false);
  expect(isDimmed(at(2026, 11, 18, 23, 59), midnight)).toBe(false);
});

test("startMinuteDimmedEndMinuteNot", () => {
  const p = [period("09:05", "14:30", [4])];
  expect(isDimmed(at(2026, 11, 19, 9, 4, 59), p)).toBe(false);
  expect(isDimmed(at(2026, 11, 19, 9, 5, 0), p)).toBe(true);
  expect(isDimmed(at(2026, 11, 19, 14, 29, 59), p)).toBe(true);
  expect(isDimmed(at(2026, 11, 19, 14, 30, 0), p)).toBe(false);
});
