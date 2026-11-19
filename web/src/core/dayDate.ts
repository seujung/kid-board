import type { Weekday } from "./domain";

export interface TimeOfDay {
  hour: number;
  minute: number;
}

export function compareTime(a: TimeOfDay, b: TimeOfDay): number {
  return a.hour !== b.hour ? a.hour - b.hour : a.minute - b.minute;
}

export interface DayDate {
  year: number;
  month: number;
  day: number;
}

export function dayDateOf(date: Date): DayDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function noon(d: DayDate): Date {
  return new Date(d.year, d.month - 1, d.day, 12, 0, 0);
}

export function weekdayOf(d: DayDate): Weekday {
  const raw = noon(d).getDay(); // 0 = 일 … 6 = 토
  return (raw === 0 ? 7 : raw) as Weekday;
}

export function addDays(d: DayDate, n: number): DayDate {
  const base = noon(d);
  base.setDate(base.getDate() + n);
  return dayDateOf(base);
}

export function atTime(d: DayDate, t: TimeOfDay): Date {
  return new Date(d.year, d.month - 1, d.day, t.hour, t.minute, 0);
}

export function compareDay(a: DayDate, b: DayDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function sameDay(a: DayDate, b: DayDate): boolean {
  return compareDay(a, b) === 0;
}
