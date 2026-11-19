import { expect, test } from "vitest";
import { addDays, atTime, dayDateOf, weekdayOf, compareTime } from "../../src/core/dayDate";
import { at } from "../support";

test("weekdayOfThursday", () => {
  expect(weekdayOf(dayDateOf(at(2026, 11, 19, 9)))).toBe(4);
});
test("weekdayOfSunday", () => {
  expect(weekdayOf(dayDateOf(at(2026, 11, 22)))).toBe(7);
});
test("addingDaysCrossesMonth", () => {
  expect(addDays({ year: 2026, month: 11, day: 30 }, 1)).toEqual({ year: 2026, month: 12, day: 1 });
});
test("dateAtTime", () => {
  expect(atTime({ year: 2026, month: 11, day: 19 }, { hour: 8, minute: 20 }).getTime()).toBe(
    at(2026, 11, 19, 8, 20).getTime(),
  );
});
test("timeOfDayOrdering", () => {
  expect(compareTime({ hour: 8, minute: 20 }, { hour: 21, minute: 30 })).toBeLessThan(0);
});
test("addDaysCrossesYearAndLeapDay", () => {
  expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
  expect(addDays({ year: 2028, month: 2, day: 28 }, 1)).toEqual({ year: 2028, month: 2, day: 29 });
  expect(addDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({ year: 2026, month: 2, day: 28 });
});
