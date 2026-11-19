import { expect, test } from "vitest";
import type { TaskScheduleInfo } from "../../src/core/domain";
import type { DayDate } from "../../src/core/dayDate";
import { changeSchedule } from "../../src/core/scheduleEditor";

const taskID = "task";
const today: DayDate = { year: 2026, month: 11, day: 19 };

test("editorModifiesInPlaceWhenStartedToday", () => {
  const s: TaskScheduleInfo = { id: "s1", taskID, slot: "morning", weekdays: [1], startOn: today, endOn: null };
  const input = [s];
  const result = changeSchedule(input, taskID, "evening", [2, 4], today, "new");
  expect(result.length).toBe(1);
  expect(result[0]!.id).toBe("s1");
  expect(result[0]!.slot).toBe("evening");
  expect(result[0]!.weekdays).toEqual([2, 4]);
  expect(s.slot).toBe("morning");
  expect(input).toHaveLength(1);
});

test("editorSplitsWhenStartedBefore", () => {
  const s: TaskScheduleInfo = {
    id: "s1", taskID, slot: "morning", weekdays: [1], startOn: { year: 2026, month: 11, day: 10 }, endOn: null,
  };
  const result = changeSchedule([s], taskID, "evening", [4], today, "new");
  expect(result.length).toBe(2);
  expect(result[0]!.endOn).toEqual({ year: 2026, month: 11, day: 18 });
  expect(result[1]!.id).toBe("new");
  expect(result[1]!.startOn).toEqual(today);
  expect(result[1]!.endOn).toBeNull();
  expect(result[1]!.slot).toBe("evening");
  expect(result[1]!.weekdays).toEqual([4]);
  expect(s.endOn).toBeNull();
});

test("editorLeavesOtherTasksUntouched", () => {
  const other: TaskScheduleInfo = {
    id: "o", taskID: "other", slot: "morning", weekdays: [1], startOn: { year: 2026, month: 11, day: 1 }, endOn: null,
  };
  const result = changeSchedule([other], taskID, "evening", [4], today, "new");
  expect(result.length).toBe(2);
  expect(result[0]).toEqual(other);
  expect(result[1]!.taskID).toBe(taskID);
  expect(result[1]!.startOn).toEqual(today);
});
