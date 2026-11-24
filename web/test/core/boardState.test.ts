import { expect, test } from "vitest";
import { boardState, canToggle } from "../../src/core/boardState";
import { countdownLabel, finishedText, formatCountdown, remainingText } from "../../src/core/copy";
import type { DayDate, TimeOfDay } from "../../src/core/dayDate";
import type { BoardData, ChildInfo, DailyTimesInfo, TaskInfo, TimeSlot, Weekday } from "../../src/core/domain";
import { at } from "../support";

const kid: ChildInfo = { id: "kid", name: "민준", avatar: "star", themeColor: "blue", order: 0, calendars: [] };
const start: DayDate = { year: 2026, month: 1, day: 1 };
const thu: DayDate = { year: 2026, month: 11, day: 19 };
const ALL: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

let counter = 0;
function makeTask(order: number, slot: TimeSlot) {
  counter += 1;
  const task: TaskInfo = { id: `t${counter}`, childID: kid.id, title: `t${order}`, icon: "i", order, createdAt: 0, archivedOn: null };
  return { task, schedule: { id: `s${counter}`, taskID: task.id, slot, weekdays: ALL, startOn: start, endOn: null } };
}
type Pair = ReturnType<typeof makeTask>;

function makeData(
  pairs: Pair[],
  opts: { school?: TimeOfDay | null; times?: boolean; done?: [TaskInfo, DayDate][] } = {},
): BoardData {
  const school = opts.school === undefined ? { hour: 8, minute: 20 } : opts.school;
  const times: DailyTimesInfo[] =
    opts.times === false
      ? []
      : ALL.map((w) => ({
          childID: kid.id,
          weekday: w,
          schoolTime: w === 6 || w === 7 ? null : school,
          bedTime: { hour: 21, minute: 30 },
        }));
  return {
    children: [kid],
    tasks: pairs.map((p) => p.task),
    schedules: pairs.map((p) => p.schedule),
    times,
    completions: (opts.done ?? []).map(([t, day]) => ({ childID: kid.id, taskID: t.id, day, completedAt: 0 })),
  };
}

const ids = (s: { visibleTasks: { task: { id: string } }[] }) => s.visibleTasks.map((v) => v.task.id);

test("beforeSchoolIsMorningWithSchoolDeadline", () => {
  const m = makeTask(0, "morning"), e = makeTask(1, "evening");
  const s = boardState(kid, at(2026, 11, 19, 7, 42), makeData([m, e]));
  expect(s.phase).toEqual({ kind: "morning", deadline: at(2026, 11, 19, 8, 20) });
  expect(ids(s)).toEqual([m.task.id]);
});

test("atSchoolTimeIsEvening", () => {
  const m = makeTask(0, "morning"), e = makeTask(1, "evening");
  const s = boardState(kid, at(2026, 11, 19, 8, 20, 0), makeData([m, e]));
  expect(s.phase).toEqual({ kind: "evening", deadline: at(2026, 11, 19, 21, 30) });
  expect(ids(s)).toEqual([e.task.id]);
});

test("morningTaskNotToggleableAtSchoolTime", () => {
  const m = makeTask(0, "morning"), e = makeTask(1, "evening");
  const data = makeData([m, e]);
  const now = at(2026, 11, 19, 8, 20, 0);
  expect(canToggle(m.task.id, kid.id, now, data)).toBe(false);
  expect(canToggle(e.task.id, kid.id, now, data)).toBe(true);
});

test("eveningTaskNotToggleableInMorning", () => {
  const m = makeTask(0, "morning"), e = makeTask(1, "evening");
  const data = makeData([m, e]);
  const now = at(2026, 11, 19, 7, 0);
  expect(canToggle(e.task.id, kid.id, now, data)).toBe(false);
  expect(canToggle(m.task.id, kid.id, now, data)).toBe(true);
});

test("noSchoolDayShowsAllTasksUntilBed", () => {
  const m = makeTask(0, "morning"), e = makeTask(1, "evening");
  const s = boardState(kid, at(2026, 11, 21, 10, 0), makeData([m, e]));
  expect(s.phase).toEqual({ kind: "allDay", deadline: at(2026, 11, 21, 21, 30) });
  expect(ids(s)).toEqual([m.task.id, e.task.id]);
});

test("allDayTasksToggleableAndUndoable", () => {
  const m = makeTask(0, "morning"), e = makeTask(1, "evening");
  const now = at(2026, 11, 21, 10, 0);
  const sat: DayDate = { year: 2026, month: 11, day: 21 };
  const fresh = makeData([m, e]);
  expect(canToggle(m.task.id, kid.id, now, fresh)).toBe(true);
  expect(canToggle(e.task.id, kid.id, now, fresh)).toBe(true);
  const done = makeData([m, e], { done: [[m.task, sat], [e.task, sat]] });
  expect(canToggle(m.task.id, kid.id, now, done)).toBe(true);
  expect(canToggle(e.task.id, kid.id, now, done)).toBe(true);
});

test("afterBedIsFinishedNotAllDone", () => {
  const m = makeTask(0, "morning");
  const data = makeData([m]);
  const now = at(2026, 11, 19, 22, 0);
  const s = boardState(kid, now, data);
  expect(s.phase).toEqual({ kind: "finished", allDone: false });
  expect(s.nowTaskID).toBeNull();
  expect(canToggle(m.task.id, kid.id, now, data)).toBe(false);
});

test("afterBedIsFinishedAllDone", () => {
  const m = makeTask(0, "morning"), e = makeTask(1, "evening");
  const data = makeData([m, e], { done: [[m.task, thu], [e.task, thu]] });
  const s = boardState(kid, at(2026, 11, 19, 22, 0), data);
  expect(s.phase).toEqual({ kind: "finished", allDone: true });
  expect(s.remaining).toBe(0);
});

test("finishedWithZeroTasksIsAllDone", () => {
  const s = boardState(kid, at(2026, 11, 19, 22, 0), makeData([]));
  expect(s.phase).toEqual({ kind: "finished", allDone: true });
});

test("nowTaskIsFirstUndone", () => {
  const [t0, t1, t2] = [makeTask(0, "morning"), makeTask(1, "morning"), makeTask(2, "morning")] as [Pair, Pair, Pair];
  const data = makeData([t0, t1, t2], { done: [[t0.task, thu]] });
  const s = boardState(kid, at(2026, 11, 19, 7, 0), data);
  expect(s.nowTaskID).toBe(t1.task.id);
  expect(s.remaining).toBe(2);
  expect(s.doneTaskIDs).toEqual(new Set([t0.task.id]));
  expect(Math.abs(s.progress - 1 / 3)).toBeLessThan(1e-9);
});

test("zeroVisibleTasksProgressIsZero", () => {
  const s = boardState(kid, at(2026, 11, 19, 7, 0), makeData([]));
  expect(s.progress).toBe(0);
  expect(s.remaining).toBe(0);
});

test("missingTimesUsesDefaults", () => {
  const m = makeTask(0, "morning");
  const s = boardState(kid, at(2026, 11, 19, 10, 0), makeData([m], { times: false }));
  expect(s.phase).toEqual({ kind: "allDay", deadline: at(2026, 11, 19, 21, 30) });
});

test("midnightRollsToNewDay", () => {
  const m = makeTask(0, "morning");
  const data = makeData([m], { done: [[m.task, thu]] });
  const before = boardState(kid, at(2026, 11, 19, 23, 59, 59), data);
  const after = boardState(kid, at(2026, 11, 20, 0, 0, 0), data);
  expect(before.day).toEqual(thu);
  expect(after.day).toEqual({ year: 2026, month: 11, day: 20 });
  expect(after.doneTaskIDs.size).toBe(0);
});

test("unknownChildCannotToggle", () => {
  const m = makeTask(0, "morning");
  expect(canToggle(m.task.id, "nobody", at(2026, 11, 19, 7, 0), makeData([m]))).toBe(false);
});

test("copyTexts", () => {
  expect(remainingText(2)).toBe("할 일 2개 남았어!");
  expect(remainingText(0)).toBe("다 했어! 최고야!");
  expect(finishedText(true)).toBe("오늘 수고했어!");
  expect(finishedText(false)).toBe("내일 또 해 보자");
  const d = at(2026, 11, 19);
  expect(countdownLabel({ kind: "morning", deadline: d })).toBe("등교까지");
  expect(countdownLabel({ kind: "evening", deadline: d })).toBe("잘 준비까지");
  expect(countdownLabel({ kind: "allDay", deadline: d })).toBe("잘 준비까지");
  expect(countdownLabel({ kind: "finished", allDone: true })).toBeNull();
});

test("formatCountdown", () => {
  expect(formatCountdown((37 * 60 + 55) * 1000)).toBe("37분 55초");
  expect(formatCountdown((89 * 60 + 55) * 1000)).toBe("1시간 29분 55초");
  expect(formatCountdown(0)).toBe("0분 00초");
  expect(formatCountdown(-5000)).toBe("0분 00초");
  expect(formatCountdown(59999)).toBe("0분 59초");
  expect(formatCountdown(5000)).toBe("0분 05초");
});
