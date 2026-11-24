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
  /** iCal 주소입니다(예: https://calendar.google.com/calendar/ical/.../private-.../basic.ics). */
  url: string;
  /** 부모 모드와 보드에서 구분하기 위한 이름입니다. 비어 있을 수 있습니다. */
  label: string;
  /** 캘린더 표시 색(#RRGGBB)입니다. 없으면 null입니다. */
  color: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  allDay: boolean;
  /** 00:00 기준 분(0~1440). 종일 일정이면 null입니다. */
  startMin: number | null;
  /** 00:00 기준 분(0~1440). 종일 일정이면 null입니다. */
  endMin: number | null;
  calendarLabel: string;
  calendarColor: string | null;
}

export interface CalendarCacheEntry {
  /** YYYY-MM-DD */
  dayKey: string;
  /** 캘린더 목록(url·label·color) 서명 */
  signature: string;
  /** epoch ms */
  fetchedAt: number;
  events: CalendarEvent[];
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
