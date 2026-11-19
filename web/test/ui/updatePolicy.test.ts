import { expect, test } from "vitest";
import { shouldApplyUpdate } from "../../src/ui/display/updates";
import { at } from "../support";

const MIN = 60_000;

test("appliesOnlyAtQuietNightOrParentRequest", () => {
  const noon = at(2026, 11, 19, 12, 0);
  expect(shouldApplyUpdate({ waiting: true, now: noon, lastInputAt: noon.getTime() - 60 * MIN, parentRequested: false })).toBe(false);
  const night = at(2026, 11, 19, 23, 0);
  expect(shouldApplyUpdate({ waiting: true, now: night, lastInputAt: night.getTime() - 5 * MIN, parentRequested: false })).toBe(true);
  expect(shouldApplyUpdate({ waiting: true, now: night, lastInputAt: night.getTime() - 4 * MIN, parentRequested: false })).toBe(false);
  expect(shouldApplyUpdate({ waiting: true, now: noon, lastInputAt: noon.getTime(), parentRequested: true })).toBe(true);
  expect(shouldApplyUpdate({ waiting: false, now: night, lastInputAt: night.getTime() - 60 * MIN, parentRequested: true })).toBe(false);
  expect(shouldApplyUpdate({ waiting: false, now: night, lastInputAt: night.getTime() - 60 * MIN, parentRequested: false })).toBe(false);
});
