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

export interface ChildCalendar {
  id: string;
  /** 디코딩된 Google Calendar ID입니다. */
  src: string;
  /** IANA 시간대입니다. 기본값은 "Asia/Seoul"입니다. */
  ctz: string;
  /** 부모 모드에서 구분하기 위한 이름입니다. 비어 있을 수 있습니다. */
  label: string;
  /** Google Calendar 임베드 색(#RRGGBB)입니다. 없으면 null입니다. */
  color: string | null;
}

export interface ChildInfo {
  id: string;
  name: string;
  avatar: string;
  themeColor: string;
  order: number;
  calendars: ChildCalendar[];
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
