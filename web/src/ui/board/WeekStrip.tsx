import { addDays, sameDay, weekdayOf } from "../../core/dayDate";
import type { DayDate } from "../../core/dayDate";
import { WEEKDAY_KO } from "../../core/domain";
import type { BoardData } from "../../core/domain";
import { isStar, summaryOn } from "../../core/scheduleEngine";
import { StarStamp } from "./Stamp";

/** 오늘이 든 주(월요일 시작) 7일입니다. */
export function weekOf(today: DayDate): DayDate[] {
  const monday = addDays(today, -(weekdayOf(today) - 1));
  return [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(monday, n));
}

export interface WeekStripProps {
  childID: string;
  today: DayDate;
  /** 읽기 전용으로 보고 있는 날입니다. 없으면 오늘을 보고 있습니다. */
  selected: DayDate | null;
  data: BoardData;
  onSelect(day: DayDate): void;
}

/** 이번 주 월~일 7칸입니다. 그날 전체 할 일의 완료 수를 표시하고, 모두 끝낸 날에는 별 도장을 찍습니다. */
export function WeekStrip({ childID, today, selected, data, onSelect }: WeekStripProps) {
  return (
    <div class="week">
      {weekOf(today).map((day) => {
        const weekday = weekdayOf(day);
        const summary = summaryOn(childID, day, data);
        const star = isStar(summary);
        const isToday = sameDay(day, today);
        const isSelected = !isToday && selected !== null && sameDay(day, selected);
        let cls = "week-cell";
        if (isToday) cls += " today";
        if (isSelected) cls += " selected";
        if (weekday === 6) cls += " sat";
        if (weekday === 7) cls += " sun";
        return (
          <button
            key={`${day.month}-${day.day}`}
            type="button"
            class={cls}
            onClick={() => onSelect(day)}
            aria-label={`${WEEKDAY_KO[weekday]}요일 ${day.month}월 ${day.day}일, ${summary.done}/${summary.total}${star ? ", 별" : ""}${isToday ? ", 오늘" : ""}`}
          >
            {isToday && <span class="today-badge">오늘</span>}
            <span class="week-name">{WEEKDAY_KO[weekday]}</span>
            <span class="week-date">
              {day.month}/{day.day}
            </span>
            <span class="week-count">{star ? <StarStamp /> : `${summary.done}/${summary.total}`}</span>
          </button>
        );
      })}
    </div>
  );
}
