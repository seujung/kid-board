import type { Clock } from "../../clock";
import { classifyTodayEvents, formatEventTime } from "../../core/calendar";
import type { DayDate } from "../../core/dayDate";
import type { ChildInfo } from "../../core/domain";
import type { BoardStore } from "../../store/boardStore";
import { useChildCalendar } from "./useCalendars";

export interface TodayCalendarProps {
  store: BoardStore;
  clock: Clock;
  child: ChildInfo;
  day: DayDate;
  now: Date;
}

/** 자녀에게 등록된 iCal 캘린더들의 오늘 일정을 현재 시각 기준으로 표시합니다. */
export function TodayCalendar({ store, clock, child, day, now }: TodayCalendarProps) {
  const state = useChildCalendar(store, child, day, clock);
  if (state.kind === "none") return null;

  const canRefresh = state.kind === "ready" || state.kind === "error";
  const refreshing = state.kind === "ready" && state.refreshing;

  let body;
  if (state.kind === "noProxy") {
    body = <div class="calendar-empty">부모 모드에서 캘린더 프록시 주소를 설정해 주세요</div>;
  } else if (state.kind === "loading") {
    body = <div class="calendar-empty">오늘 일정을 불러오는 중…</div>;
  } else if (state.kind === "error") {
    body = (
      <div class="calendar-empty">
        <span>일정을 불러오지 못했어요</span>
        <button type="button" class="calendar-retry" onClick={state.refreshNow}>
          다시 시도
        </button>
      </div>
    );
  } else {
    const classified = classifyTodayEvents(state.events, now);
    if (classified.length === 0) {
      body = <div class="calendar-empty">오늘 일정이 없어요</div>;
    } else {
      body = (
        <ul class={state.stale ? "cal-events stale" : "cal-events"}>
          {classified.map(({ event, status }) => (
            <li key={event.id} class={`cal-event ${status}`}>
              <span class="cal-event-bar" style={{ background: event.calendarColor ?? "var(--accent)" }} />
              <span class="cal-event-time">{formatEventTime(event)}</span>
              <span class="cal-event-title">{event.title}</span>
              {child.calendars.length > 1 && event.calendarLabel && (
                <span class="cal-event-source">{event.calendarLabel}</span>
              )}
              {status === "ongoing" && <span class="cal-event-badge ongoing">지금</span>}
              {status === "next" && <span class="cal-event-badge next">다음</span>}
            </li>
          ))}
        </ul>
      );
    }
  }

  return (
    <div class="calendar-section">
      <div class="calendar-head">
        <h3 class="calendar-title">
          📅 오늘 일정{" "}
          {state.kind === "ready" && <span class="calendar-count">{state.events.length}</span>}
        </h3>
        {canRefresh && (
          <button
            type="button"
            class="calendar-refresh"
            aria-label="일정 새로고침"
            disabled={refreshing}
            onClick={state.refreshNow}
          >
            ↻
          </button>
        )}
      </div>
      <div class="calendar-card">{body}</div>
    </div>
  );
}
