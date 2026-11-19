import { expect, test } from "vitest";
import type { BoardData, TaskInfo, TaskScheduleInfo, TimeSlot, Weekday } from "../../src/core/domain";
import type { DayDate } from "../../src/core/dayDate";
import { isStar, summaryOn, tasksOn, timesOn } from "../../src/core/scheduleEngine";
import { at } from "../support";

const kid = "kid";
const d17: DayDate = { year: 2026, month: 11, day: 17 };
const d18: DayDate = { year: 2026, month: 11, day: 18 };
const d19: DayDate = { year: 2026, month: 11, day: 19 };
const d24: DayDate = { year: 2026, month: 11, day: 24 };
const longAgo: DayDate = { year: 2026, month: 1, day: 1 };
const ALL: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

let counter = 0;
function nextID(): string {
  counter += 1;
  return `id${counter}`;
}

function task(order = 0, archivedOn: DayDate | null = null, id: string = nextID()): TaskInfo {
  return { id, childID: kid, title: "t", icon: "star", order, createdAt: 0, archivedOn };
}

function schedule(
  t: TaskInfo,
  slot: TimeSlot = "morning",
  weekdays: Weekday[] = ALL,
  start: DayDate = longAgo,
  end: DayDate | null = null,
): TaskScheduleInfo {
  return { id: nextID(), taskID: t.id, slot, weekdays, startOn: start, endOn: end };
}

function board(partial: Partial<BoardData>): BoardData {
  return { children: [], tasks: [], schedules: [], times: [], completions: [], ...partial };
}

test("tasksFilteredByWeekday", () => {
  const t = task();
  const data = board({ tasks: [t], schedules: [schedule(t, "morning", [1, 3])] });
  expect(tasksOn(kid, d19, data)).toEqual([]);
  expect(tasksOn(kid, d18, data).map((s) => s.task.id)).toEqual([t.id]);
});

test("tasksOrderedMorningFirstThenOrder", () => {
  const e0 = task(0, null, "e0");
  const m1 = task(1, null, "m1");
  const m0 = task(0, null, "m0");
  const data = board({
    tasks: [e0, m1, m0],
    schedules: [schedule(e0, "evening"), schedule(m1, "morning"), schedule(m0, "morning")],
  });
  const result = tasksOn(kid, d19, data);
  expect(result.map((s) => s.task.id)).toEqual(["m0", "m1", "e0"]);
  expect(result.map((s) => s.slot)).toEqual(["morning", "morning", "evening"]);
});

test("archivedTaskHiddenFromArchiveDay", () => {
  const t = task(0, d19);
  const data = board({ tasks: [t], schedules: [schedule(t)] });
  expect(tasksOn(kid, d18, data).length).toBe(1);
  expect(tasksOn(kid, d19, data)).toEqual([]);
});

test("pastDayUsesScheduleValidThatDay", () => {
  const t = task();
  const old = schedule(t, "morning", [1, 2, 3, 4, 5], longAgo, d17);
  const next = schedule(t, "morning", [1], d18);
  const data = board({ tasks: [t], schedules: [old, next] });
  expect(tasksOn(kid, d17, data).length).toBe(1);
  expect(tasksOn(kid, d24, data)).toEqual([]);
});

test("summaryCountsDoneOfThatDayOnly", () => {
  const a = task(0);
  const b = task(1);
  const data = board({
    tasks: [a, b],
    schedules: [schedule(a), schedule(b)],
    completions: [
      { childID: kid, taskID: a.id, day: d19, completedAt: at(2026, 11, 19, 8).getTime() },
      { childID: kid, taskID: b.id, day: d18, completedAt: at(2026, 11, 18, 8).getTime() },
    ],
  });
  expect(summaryOn(kid, d19, data)).toEqual({ done: 1, total: 2 });
});

test("summaryZeroTasksIsNotStar", () => {
  const s = summaryOn(kid, d19, board({}));
  expect(s).toEqual({ done: 0, total: 0 });
  expect(isStar(s)).toBe(false);
});

test("summaryAllDoneIsStar", () => {
  const a = task(0);
  const b = task(1);
  const data = board({
    tasks: [a, b],
    schedules: [schedule(a), schedule(b)],
    completions: [
      { childID: kid, taskID: a.id, day: d19, completedAt: at(2026, 11, 19, 8).getTime() },
      { childID: kid, taskID: b.id, day: d19, completedAt: at(2026, 11, 19, 9).getTime() },
    ],
  });
  const s = summaryOn(kid, d19, data);
  expect(s).toEqual({ done: 2, total: 2 });
  expect(isStar(s)).toBe(true);
});

test("missingTimesDefaultToNoSchoolAndBed2130", () => {
  const t = timesOn(kid, d19, board({}));
  expect(t.schoolTime).toBeNull();
  expect(t.bedTime).toEqual({ hour: 21, minute: 30 });
  expect(t.weekday).toBe(4);
  expect(t.childID).toBe(kid);
});

test("archivedTaskCompletionCountsOnPastDay", () => {
  const t = task(0, d19);
  const data = board({
    tasks: [t],
    schedules: [schedule(t)],
    completions: [{ childID: kid, taskID: t.id, day: d18, completedAt: at(2026, 11, 18, 8).getTime() }],
  });
  expect(summaryOn(kid, d18, data)).toEqual({ done: 1, total: 1 });
  expect(summaryOn(kid, d19, data).total).toBe(0);
});

test("sameOrderTieBreaksById", () => {
  const b = task(0, null, "b");
  const a = task(0, null, "a");
  const data = board({ tasks: [b, a], schedules: [schedule(b), schedule(a)] });
  expect(tasksOn(kid, d19, data).map((s) => s.task.id)).toEqual(["a", "b"]);
});
