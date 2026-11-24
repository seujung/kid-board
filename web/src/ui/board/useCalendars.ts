import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { Clock } from "../../clock";
import {
  CALENDAR_REFRESH_MS,
  CALENDAR_STALE_AFTER_MS,
  buildProxyRequestURL,
  calendarSignature,
  formatDayKey,
} from "../../core/calendar";
import type { DayDate } from "../../core/dayDate";
import type { CalendarEvent, ChildInfo } from "../../core/domain";
import { parseIcsEventsForDay } from "../../core/ical";
import type { BoardStore } from "../../store/boardStore";

export type TextFetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<string>;

export const textFetcher: TextFetcher = async (url, init) => {
  const res = await fetch(url, { redirect: "follow", signal: init?.signal });
  if (res.status < 200 || res.status > 299) {
    throw new Error(`bad status ${res.status}`);
  }
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.indexOf("{") === 0) {
    try {
      const json = JSON.parse(trimmed) as { error?: unknown };
      if (json && typeof json === "object" && "error" in json) {
        throw new Error(String(json.error));
      }
    } catch (e) {
      if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
    }
  }
  return text;
};

export type ChildCalendarState =
  | { kind: "none" }
  | { kind: "noProxy" }
  | { kind: "loading" }
  | { kind: "error"; refreshNow: () => void }
  | { kind: "ready"; events: CalendarEvent[]; stale: boolean; refreshing: boolean; refreshNow: () => void };

/**
 * 자녀에게 등록된 iCal 주소 목록을 프록시로 조회해 오늘 일정으로 파싱하고 `store.setCalendarCache`에 저장합니다.
 * 캐시가 있으면 즉시 보여 주고, 백그라운드에서 15분마다 새로고침합니다.
 */
export function useChildCalendar(
  store: BoardStore,
  child: ChildInfo,
  day: DayDate,
  clock: Clock,
  fetcher: TextFetcher = textFetcher,
): ChildCalendarState {
  const [, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => store.subscribe(() => setVersion((v) => v + 1)), [store]);

  const calendars = child.calendars;
  const proxyUrl = store.settings().calendarProxyUrl;
  const dayKey = formatDayKey(day);
  const signature = calendarSignature(calendars);
  const fetchKey = calendars.length > 0 && proxyUrl ? `${proxyUrl}|${dayKey}|${signature}` : null;

  const fetchNow = useCallback(() => {
    controller.current?.abort();
    const currentProxy = store.settings().calendarProxyUrl;
    const currentChild = store.snapshot().children.find((c) => c.id === child.id);
    const list = currentChild ? currentChild.calendars : calendars;
    if (!currentProxy || list.length === 0) {
      controller.current = null;
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    controller.current = ctrl;
    setLoading(true);
    setFailed(false);

    Promise.allSettled(
      list.map(async (cal) => {
        const requestUrl = buildProxyRequestURL(currentProxy, cal.url);
        const text = await fetcher(requestUrl, { signal: ctrl.signal });
        return parseIcsEventsForDay(text, day, { label: cal.label, color: cal.color });
      }),
    )
      .then((results) => {
        if (ctrl.signal.aborted) return;
        controller.current = null;
        let fulfilledCount = 0;
        const merged: CalendarEvent[] = [];
        for (const r of results) {
          if (r.status === "fulfilled") {
            fulfilledCount += 1;
            merged.push(...r.value);
          }
        }
        setLoading(false);
        if (fulfilledCount > 0) {
          setFailed(false);
          return store
            .setCalendarCache(child.id, {
              dayKey: formatDayKey(day),
              signature: calendarSignature(list),
              fetchedAt: clock.now().getTime(),
              events: merged,
            })
            .catch(() => undefined);
        }
        setFailed(true);
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        controller.current = null;
        setLoading(false);
        setFailed(true);
      });
  }, [store, child.id, calendars, day, clock, fetcher]);

  useEffect(() => {
    if (fetchKey === null) {
      controller.current?.abort();
      controller.current = null;
      setLoading(false);
      setFailed(false);
      return;
    }
    fetchNow();
    const timer = window.setInterval(fetchNow, CALENDAR_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      controller.current?.abort();
      controller.current = null;
    };
  }, [fetchKey, fetchNow]);

  if (calendars.length === 0) return { kind: "none" };
  if (!proxyUrl) return { kind: "noProxy" };

  const cached = store.calendarCache(child.id);
  if (cached && cached.dayKey === dayKey && cached.signature === signature) {
    const stale = clock.now().getTime() - cached.fetchedAt > CALENDAR_STALE_AFTER_MS;
    return { kind: "ready", events: cached.events, stale, refreshing: loading, refreshNow: fetchNow };
  }
  if (failed && !loading) {
    return { kind: "error", refreshNow: fetchNow };
  }
  return { kind: "loading" };
}
