import { addDays, compareDay, weekdayOf } from "../../core/dayDate";
import type { DayDate, TimeOfDay } from "../../core/dayDate";
import { WEEKDAY_KO } from "../../core/domain";
import type { BoardData, TaskInfo, TaskScheduleInfo, TimeSlot, Weekday } from "../../core/domain";
import type { DaySummary } from "../../core/scheduleEngine";
import { isStar } from "../../core/scheduleEngine";
import type { GeoPlace } from "../../core/weather";

export const ALL_WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
export const HISTORY_DAYS = 28;
export const BACKUP_REMIND_DAYS = 7;
const DAY_MS = 86_400_000;

/** 복구 코드 "12345678"을 "1234 5678"로 보여 줍니다. */
export function formatRecoveryCode(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

/** 지역 검색 결과 이름입니다. 시도가 없거나 이름과 같으면 이름만 씁니다. */
export function placeLabel(place: GeoPlace): string {
  if (!place.admin1 || place.admin1 === place.name) return place.name;
  return `${place.name}, ${place.admin1}`;
}

/** 완료 기록의 날짜 글자입니다. 예: "11/19 (목)" */
export function historyDateLabel(day: DayDate): string {
  return `${day.month}/${day.day} (${WEEKDAY_KO[weekdayOf(day)]})`;
}

/** 완료 기록 한 칸입니다. 할 일이 없는 날은 "-"입니다. */
export function historyCell(summary: DaySummary): string {
  if (summary.total === 0) return "-";
  return `${summary.done}/${summary.total}${isStar(summary) ? " ★" : ""}`;
}

/** 오늘부터 거꾸로 28일입니다. 최신 날짜가 먼저입니다. */
export function historyDays(today: DayDate): DayDate[] {
  const days: DayDate[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) days.push(addDays(today, -i));
  return days;
}

/** 마지막 백업 후 7일 이상 지났으면 지난 날 수입니다. 아니면(또는 백업한 적이 없으면) null입니다. */
export function backupOverdueDays(lastBackupAt: number | null, now: number): number | null {
  if (lastBackupAt === null) return null;
  const days = Math.floor((now - lastBackupAt) / DAY_MS);
  return days >= BACKUP_REMIND_DAYS ? days : null;
}

/** 요일 목록 요약입니다. 예: "매일", "월~금", "주말", "월 수 금" */
export function weekdaySummary(days: Weekday[]): string {
  const set = sortWeekdays(days);
  if (set.length === 7) return "매일";
  if (set.join() === "1,2,3,4,5") return "월~금";
  if (set.join() === "6,7") return "주말";
  return set.map((d) => WEEKDAY_KO[d]).join(" ");
}

/** 중복을 빼고 월~일 순서로 정렬합니다. */
export function sortWeekdays(days: Weekday[]): Weekday[] {
  return ALL_WEEKDAYS.filter((d) => days.indexOf(d) >= 0);
}

export function sameWeekdays(a: Weekday[], b: Weekday[]): boolean {
  return sortWeekdays(a).join() === sortWeekdays(b).join();
}

/**
 * 할 일 관리 목록입니다. `BoardStore.moveTask`와 같은 기준(보관하지 않았고, 이 시간대의 열린 일정이 있음,
 * `order` 순)이라서 목록 위치를 그대로 `moveTask`에 넘길 수 있습니다.
 */
export function editableTasks(
  childID: string,
  slot: TimeSlot,
  data: BoardData,
): { task: TaskInfo; schedule: TaskScheduleInfo }[] {
  const result: { task: TaskInfo; schedule: TaskScheduleInfo }[] = [];
  const tasks = data.tasks
    .filter((t) => t.childID === childID && t.archivedOn === null)
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const task of tasks) {
    let schedule: TaskScheduleInfo | null = null;
    for (const s of data.schedules) {
      if (s.taskID !== task.id || s.slot !== slot || s.endOn !== null) continue;
      if (!schedule || compareDay(schedule.startOn, s.startOn) < 0) schedule = s;
    }
    if (schedule) result.push({ task, schedule });
  }
  return result;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `<input type="time">` 값입니다. 예: "08:30" */
export function timeValue(t: TimeOfDay): string {
  return `${pad2(t.hour)}:${pad2(t.minute)}`;
}

/** `<input type="time">` 값을 읽습니다. 형식이 맞지 않으면 null입니다. */
export function parseTimeValue(v: string): TimeOfDay | null {
  const m = /^([0-9]{2}):([0-9]{2})/.exec(v);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}
