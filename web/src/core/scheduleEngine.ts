import { compareDay, sameDay, weekdayOf } from "./dayDate";
import type { DayDate } from "./dayDate";
import type { BoardData, DailyTimesInfo, TaskInfo, TimeSlot } from "./domain";

export interface ScheduledTask {
  task: TaskInfo;
  slot: TimeSlot;
}

export interface DaySummary {
  done: number;
  total: number;
}

export function isStar(s: DaySummary): boolean {
  return s.total > 0 && s.done === s.total;
}

export function tasksOn(childID: string, day: DayDate, data: BoardData): ScheduledTask[] {
  const weekday = weekdayOf(day);
  const result: ScheduledTask[] = [];
  for (const task of data.tasks) {
    if (task.childID !== childID) continue;
    if (task.archivedOn && compareDay(task.archivedOn, day) <= 0) continue;
    const schedule = data.schedules.find(
      (s) =>
        s.taskID === task.id &&
        compareDay(s.startOn, day) <= 0 &&
        (s.endOn === null || compareDay(day, s.endOn) <= 0) &&
        s.weekdays.indexOf(weekday) >= 0,
    );
    if (!schedule) continue;
    result.push({ task, slot: schedule.slot });
  }
  return result.sort((a, b) => {
    if (a.slot !== b.slot) return a.slot === "morning" ? -1 : 1;
    if (a.task.order !== b.task.order) return a.task.order - b.task.order;
    return a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0;
  });
}

export function summaryOn(childID: string, day: DayDate, data: BoardData): DaySummary {
  const scheduled = tasksOn(childID, day, data);
  const doneIDs = new Set(
    data.completions.filter((c) => c.childID === childID && sameDay(c.day, day)).map((c) => c.taskID),
  );
  return { done: scheduled.filter((s) => doneIDs.has(s.task.id)).length, total: scheduled.length };
}

export function timesOn(childID: string, day: DayDate, data: BoardData): DailyTimesInfo {
  const weekday = weekdayOf(day);
  return (
    data.times.find((t) => t.childID === childID && t.weekday === weekday) ?? {
      childID,
      weekday,
      schoolTime: null,
      bedTime: { hour: 21, minute: 30 },
    }
  );
}
