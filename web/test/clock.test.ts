import { expect, test } from "vitest";
import { makeClock } from "../src/clock";

test("fixedNowOnlyInDev", () => {
  expect(makeClock("?fixedNow=2026-11-19T07:42:00%2B09:00", true).now().getHours()).toBe(7);
  expect(Math.abs(makeClock("?fixedNow=2026-11-19T07:42:00%2B09:00", false).now().getTime() - Date.now())).toBeLessThan(1000);
});

test("fixedNowAdvancesWithRealTime", async () => {
  const clock = makeClock("?fixedNow=2026-11-19T07:42:00%2B09:00", true);
  const first = clock.now().getTime();
  await new Promise((r) => setTimeout(r, 30));
  const second = clock.now().getTime();
  expect(second - first).toBeGreaterThanOrEqual(20);
  expect(first - Date.parse("2026-11-19T07:42:00+09:00")).toBeLessThan(1000);
});

test("fixedNowAcceptsUnencodedPlus", () => {
  expect(makeClock("?fixedNow=2026-11-19T20:00:00+09:00", true).now().getHours()).toBe(20);
});

test("invalidOrMissingFixedNowUsesRealTime", () => {
  for (const search of ["", "?fixedNow=garbage", "?other=1"]) {
    expect(Math.abs(makeClock(search, true).now().getTime() - Date.now())).toBeLessThan(1000);
  }
});
