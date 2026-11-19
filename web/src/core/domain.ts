import type { DayDate, TimeOfDay } from "./dayDate";

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAY_KO: Record<Weekday, string> = {
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
  7: "일",
};

export type TimeSlot = "morning" | "evening";

export interface ChildInfo {
  id: string;
  name: string;
  avatar: string;
  themeColor: string;
  order: number;
}

export interface TaskInfo {
  id: string;
  childID: string;
  title: string;
  icon: string;
  order: number;
  createdAt: number;
  archivedOn: DayDate | null;
}

export interface TaskScheduleInfo {
  id: string;
  taskID: string;
  slot: TimeSlot;
  weekdays: Weekday[];
  startOn: DayDate;
  endOn: DayDate | null;
}

export interface DailyTimesInfo {
  childID: string;
  weekday: Weekday;
  schoolTime: TimeOfDay | null;
  bedTime: TimeOfDay;
}

export interface CompletionInfo {
  childID: string;
  taskID: string;
  day: DayDate;
  completedAt: number;
}

export interface BoardData {
  children: ChildInfo[];
  tasks: TaskInfo[];
  schedules: TaskScheduleInfo[];
  times: DailyTimesInfo[];
  completions: CompletionInfo[];
}
