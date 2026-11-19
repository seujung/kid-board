import { expect, test } from "vitest";
import { DEFAULT_DIM_PERIODS } from "../../src/core/displayPolicy";
import type { DimPeriod } from "../../src/core/displayPolicy";
import { shouldApplyUpdate } from "../../src/ui/display/updates";
import { at } from "../support";

const MIN = 60_000;

test("appliesOnlyAtQuietNightOrParentRequest", () => {
  const noon = at(2026, 11, 19, 12, 0);
  expect(shouldApplyUpdate({ waiting: true, now: noon, lastInputAt: noon.getTime() - 60 * MIN, parentRequested: false, dimPeriods: DEFAULT_DIM_PERIODS })).toBe(false);
  const night = at(2026, 11, 19, 23, 0);
  expect(shouldApplyUpdate({ waiting: true, now: night, lastInputAt: night.getTime() - 5 * MIN, parentRequested: false, dimPeriods: DEFAULT_DIM_PERIODS })).toBe(true);
  expect(shouldApplyUpdate({ waiting: true, now: night, lastInputAt: night.getTime() - 4 * MIN, parentRequested: false, dimPeriods: DEFAULT_DIM_PERIODS })).toBe(false);
  expect(shouldApplyUpdate({ waiting: true, now: noon, lastInputAt: noon.getTime(), parentRequested: true, dimPeriods: DEFAULT_DIM_PERIODS })).toBe(true);
  expect(shouldApplyUpdate({ waiting: false, now: night, lastInputAt: night.getTime() - 60 * MIN, parentRequested: true, dimPeriods: DEFAULT_DIM_PERIODS })).toBe(false);
  expect(shouldApplyUpdate({ waiting: false, now: night, lastInputAt: night.getTime() - 60 * MIN, parentRequested: false, dimPeriods: DEFAULT_DIM_PERIODS })).toBe(false);
});

test("appliesDuringAnyDimPeriod", () => {
  // 목요일 09:00~14:00만 어둡게 합니다. 밤 22시는 어두운 시간이 아닙니다.
  const school: DimPeriod[] = [{ id: "s", start: { hour: 9, minute: 0 }, end: { hour: 14, minute: 0 }, weekdays: [4] }];
  const ten = at(2026, 11, 19, 10, 0);
  expect(shouldApplyUpdate({ waiting: true, now: ten, lastInputAt: ten.getTime() - 5 * MIN, parentRequested: false, dimPeriods: school })).toBe(true);
  expect(shouldApplyUpdate({ waiting: true, now: ten, lastInputAt: ten.getTime() - 4 * MIN, parentRequested: false, dimPeriods: school })).toBe(false);
  const night = at(2026, 11, 19, 23, 0);
  expect(shouldApplyUpdate({ waiting: true, now: night, lastInputAt: night.getTime() - 60 * MIN, parentRequested: false, dimPeriods: school })).toBe(false);
  // 어둡게 하는 구간이 없으면 부모가 요청할 때만 적용합니다.
  expect(shouldApplyUpdate({ waiting: true, now: night, lastInputAt: night.getTime() - 60 * MIN, parentRequested: false, dimPeriods: [] })).toBe(false);
  expect(shouldApplyUpdate({ waiting: true, now: night, lastInputAt: night.getTime(), parentRequested: true, dimPeriods: [] })).toBe(true);
});
