import type { TimeOfDay } from "./dayDate";
import type { Weekday } from "./domain";

export const NIGHT_WAKE_MS = 30_000;

export type BoardScene = "day" | "night";

/**
 * 화면을 어둡게 하는 구간입니다. `weekdays`는 구간이 시작하는 요일입니다(1 = 월요일).
 * `end`가 `start`보다 이르거나 같으면 자정을 넘어 다음 날 `end`까지입니다. 같으면 24시간입니다.
 */
export interface DimPeriod {
  id: string;
  start: TimeOfDay;
  end: TimeOfDay;
  weekdays: Weekday[];
}

/** 기본값은 매일 22:00~06:00입니다. 함수로 만들어 호출할 때마다 새 배열을 돌려줍니다. */
export function defaultDimPeriods(): DimPeriod[] {
  return [{ id: "default-night", start: { hour: 22, minute: 0 }, end: { hour: 6, minute: 0 }, weekdays: [1, 2, 3, 4, 5, 6, 7] }];
}

export const DEFAULT_DIM_PERIODS: readonly DimPeriod[] = defaultDimPeriods();

function weekdayOfDate(d: Date): Weekday {
  const raw = d.getDay(); // 0 = 일 … 6 = 토
  return (raw === 0 ? 7 : raw) as Weekday;
}

/**
 * 지금이 어둡게 하는 구간 안인지입니다. 분 단위로 비교합니다.
 * 시작 분은 구간에 들고, 끝 분은 들지 않습니다. 빈 목록이면 어둡게 하지 않습니다.
 */
export function isDimmed(now: Date, periods: readonly DimPeriod[]): boolean {
  const minute = now.getHours() * 60 + now.getMinutes();
  const today = weekdayOfDate(now);
  const yesterday = (today === 1 ? 7 : today - 1) as Weekday;
  for (const p of periods) {
    const start = p.start.hour * 60 + p.start.minute;
    const end = p.end.hour * 60 + p.end.minute;
    if (end > start) {
      if (p.weekdays.indexOf(today) >= 0 && minute >= start && minute < end) return true;
    } else {
      // 자정을 넘는 구간입니다. 오늘 시작한 부분과 어제 시작해 오늘로 넘어온 부분을 봅니다.
      if (p.weekdays.indexOf(today) >= 0 && minute >= start) return true;
      if (p.weekdays.indexOf(yesterday) >= 0 && minute < end) return true;
    }
  }
  return false;
}

/** 06:00 이상 18:00 미만이면 "day"입니다. */
export function sceneOf(now: Date): BoardScene {
  const h = now.getHours();
  return h >= 6 && h < 18 ? "day" : "night";
}

export function showsUmbrella(precipitationProbability: number, now: Date, latestSchoolTime: Date | null): boolean {
  if (precipitationProbability < 50 || latestSchoolTime === null) return false;
  return now.getTime() < latestSchoolTime.getTime();
}
