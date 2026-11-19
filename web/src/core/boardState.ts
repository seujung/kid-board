import { atTime, dayDateOf, sameDay } from "./dayDate";
import type { DayDate } from "./dayDate";
import type { BoardData, ChildInfo } from "./domain";
import { summaryOn, tasksOn, timesOn } from "./scheduleEngine";
import type { ScheduledTask } from "./scheduleEngine";

export type BoardPhase =
  | { kind: "morning"; deadline: Date }
  | { kind: "evening"; deadline: Date }
  | { kind: "allDay"; deadline: Date }
  | { kind: "finished"; allDone: boolean };

export interface ChildBoardState {
  child: ChildInfo;
  day: DayDate;
  phase: BoardPhase;
  visibleTasks: ScheduledTask[];
  doneTaskIDs: Set<string>;
  nowTaskID: string | null;
  remaining: number;
  progress: number;
}

function allDone(childID: string, day: DayDate, data: BoardData): boolean {
  const s = summaryOn(childID, day, data);
  return s.done === s.total;
}

export function boardState(child: ChildInfo, now: Date, data: BoardData): ChildBoardState {
  const day = dayDateOf(now);
  const all = tasksOn(child.id, day, data);
  const times = timesOn(child.id, day, data);
  const bed = atTime(day, times.bedTime);
  const school = times.schoolTime ? atTime(day, times.schoolTime) : null;
  const finished = (): BoardPhase => ({ kind: "finished", allDone: allDone(child.id, day, data) });

  let phase: BoardPhase;
  let visible: ScheduledTask[];
  if (school) {
    if (now.getTime() < school.getTime()) {
      phase = { kind: "morning", deadline: school };
      visible = all.filter((s) => s.slot === "morning");
    } else {
      visible = all.filter((s) => s.slot === "evening");
      phase = now.getTime() < bed.getTime() ? { kind: "evening", deadline: bed } : finished();
    }
  } else {
    visible = all;
    phase = now.getTime() < bed.getTime() ? { kind: "allDay", deadline: bed } : finished();
  }

  const completed = new Set(
    data.completions.filter((c) => c.childID === child.id && sameDay(c.day, day)).map((c) => c.taskID),
  );
  const doneTaskIDs = new Set(visible.map((s) => s.task.id).filter((id) => completed.has(id)));
  const remaining = visible.length - doneTaskIDs.size;
  const nowTaskID =
    phase.kind === "finished" ? null : (visible.find((s) => !doneTaskIDs.has(s.task.id))?.task.id ?? null);
  return {
    child,
    day,
    phase,
    visibleTasks: visible,
    doneTaskIDs,
    nowTaskID,
    remaining,
    progress: visible.length === 0 ? 0 : doneTaskIDs.size / visible.length,
  };
}

export function canToggle(taskID: string, childID: string, now: Date, data: BoardData): boolean {
  const child = data.children.find((c) => c.id === childID);
  if (!child) return false;
  const state = boardState(child, now, data);
  if (state.phase.kind === "finished") return false;
  return state.visibleTasks.some((s) => s.task.id === taskID);
}
