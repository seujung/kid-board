import { expect, test } from "vitest";
import type { BoardData } from "../../src/core/domain";
import {
  backupOverdueDays,
  editableTasks,
  formatRecoveryCode,
  historyCell,
  historyDateLabel,
  historyDays,
  parseTimeValue,
  placeLabel,
  timeValue,
  weekdaySummary,
} from "../../src/ui/parent/format";
import { at } from "../support";

test("recoveryCodeShowsTwoGroups", () => {
  expect(formatRecoveryCode("12345678")).toBe("1234 5678");
  expect(formatRecoveryCode("00001234")).toBe("0000 1234");
});

test("placeLabelJoinsAdmin1", () => {
  expect(placeLabel({ name: "성남시", admin1: "경기도", latitude: 0, longitude: 0 })).toBe("성남시, 경기도");
  expect(placeLabel({ name: "서울", admin1: null, latitude: 0, longitude: 0 })).toBe("서울");
  expect(placeLabel({ name: "서울", admin1: "서울", latitude: 0, longitude: 0 })).toBe("서울");
});

test("historyIsLast28DaysNewestFirst", () => {
  const days = historyDays({ year: 2026, month: 11, day: 19 });
  expect(days).toHaveLength(28);
  expect(days[0]).toEqual({ year: 2026, month: 11, day: 19 });
  expect(days[27]).toEqual({ year: 2026, month: 10, day: 23 });
  expect(historyDateLabel({ year: 2026, month: 11, day: 19 })).toBe("11/19 (목)");
  expect(historyDateLabel({ year: 2026, month: 11, day: 1 })).toBe("11/1 (일)");
});

test("historyCellText", () => {
  expect(historyCell({ done: 0, total: 0 })).toBe("-");
  expect(historyCell({ done: 3, total: 5 })).toBe("3/5");
  expect(historyCell({ done: 5, total: 5 })).toBe("5/5 ★");
});

test("backupReminderAfterSevenDays", () => {
  const now = at(2026, 11, 19, 12).getTime();
  expect(backupOverdueDays(null, now)).toBeNull();
  expect(backupOverdueDays(at(2026, 11, 13, 12).getTime(), now)).toBeNull();
  expect(backupOverdueDays(at(2026, 11, 12, 12).getTime(), now)).toBe(7);
  expect(backupOverdueDays(at(2026, 11, 1, 9).getTime(), now)).toBe(18);
});

test("weekdaySummaryNames", () => {
  expect(weekdaySummary([1, 2, 3, 4, 5, 6, 7])).toBe("매일");
  expect(weekdaySummary([5, 4, 3, 2, 1])).toBe("월~금");
  expect(weekdaySummary([7, 6])).toBe("주말");
  expect(weekdaySummary([5, 1, 3])).toBe("월 수 금");
});

test("timeValueRoundTrip", () => {
  expect(timeValue({ hour: 8, minute: 5 })).toBe("08:05");
  expect(parseTimeValue("21:30")).toEqual({ hour: 21, minute: 30 });
  expect(parseTimeValue("07:45:00")).toEqual({ hour: 7, minute: 45 });
  expect(parseTimeValue("")).toBeNull();
  expect(parseTimeValue("25:00")).toBeNull();
});

test("editableTasksMatchesMoveTaskList", () => {
  const d = (day: number) => ({ year: 2026, month: 11, day });
  const data: BoardData = {
    children: [],
    tasks: [
      { id: "b", childID: "c", title: "B", icon: "", order: 2, createdAt: 0, archivedOn: null },
      { id: "a", childID: "c", title: "A", icon: "", order: 1, createdAt: 0, archivedOn: null },
      { id: "x", childID: "c", title: "X", icon: "", order: 0, createdAt: 0, archivedOn: d(18) },
      { id: "e", childID: "c", title: "E", icon: "", order: 3, createdAt: 0, archivedOn: null },
      { id: "o", childID: "other", title: "O", icon: "", order: 0, createdAt: 0, archivedOn: null },
    ],
    schedules: [
      { id: "s1", taskID: "b", slot: "morning", weekdays: [1], startOn: d(1), endOn: null },
      { id: "s2", taskID: "a", slot: "morning", weekdays: [2], startOn: d(1), endOn: null },
      { id: "s3", taskID: "x", slot: "morning", weekdays: [1], startOn: d(1), endOn: null },
      { id: "s4", taskID: "e", slot: "morning", weekdays: [1], startOn: d(1), endOn: d(18) },
      { id: "s5", taskID: "e", slot: "evening", weekdays: [1], startOn: d(19), endOn: null },
      { id: "s6", taskID: "o", slot: "morning", weekdays: [1], startOn: d(1), endOn: null },
    ],
    times: [],
    completions: [],
  };
  expect(editableTasks("c", "morning", data).map((t) => t.task.id)).toEqual(["a", "b"]);
  const evening = editableTasks("c", "evening", data);
  expect(evening.map((t) => t.task.id)).toEqual(["e"]);
  expect(evening[0]?.schedule.id).toBe("s5");
});
