import { useEffect, useState } from "preact/hooks";
import { CALENDAR_REFRESH_MS, buildTodayAgendaEmbedURL } from "../../core/calendar";
import type { DayDate } from "../../core/dayDate";
import type { ChildCalendar } from "../../core/domain";

export interface TodayCalendarProps {
  childName: string;
  calendars: ChildCalendar[];
  day: DayDate;
}

/** 자녀에게 등록된 Google 캘린더들의 오늘 일정을 AGENDA 임베드로 표시합니다. */
export function TodayCalendar({ childName, calendars, day }: TodayCalendarProps) {
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setReloadTick((n) => n + 1), CALENDAR_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const embedURL = buildTodayAgendaEmbedURL(calendars, day);
  if (!embedURL) return null;

  return (
    <div class="calendar-section">
      <div class="calendar-head">
        <h3 class="calendar-title">
          📅 오늘 일정 {calendars.length > 1 && <span class="calendar-count">{calendars.length}개</span>}
        </h3>
        <button
          type="button"
          class="calendar-refresh"
          aria-label="일정 새로고침"
          onClick={() => setReloadTick((n) => n + 1)}
        >
          ↻
        </button>
      </div>
      <div class="calendar-frame-wrap">
        <iframe
          key={`${embedURL}|${reloadTick}`}
          class="calendar-frame"
          src={embedURL}
          title={`${childName} 오늘 일정`}
          frameBorder="0"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
