import type { DayDate } from "./dayDate";
import type { CalendarEvent, ChildCalendar } from "./domain";

export const CALENDAR_REFRESH_MS = 900_000;
export const CALENDAR_STALE_AFTER_MS = 10_800_000;
export const CALENDAR_COLOR_PRESETS = ["#E85A4F", "#3B82C4", "#2E9E7A", "#8A6BD1", "#E0A21B", "#D96B27"];

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const IFRAME_TAG_RE = /<iframe\b/i;
const GOOGLE_ICAL_PATH_RE = /^\/calendar\/ical\/([^/]+)\//i;

export function normalizeHexColor(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toUpperCase() : null;
}

export function parseIcalUrlInput(input: string): { ok: true; url: string } | { ok: false; message: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, message: "iCal 주소를 입력해 주세요." };
  }
  if (IFRAME_TAG_RE.test(trimmed)) {
    return { ok: false, message: "iframe 코드 대신 Google 캘린더의 'iCal 형식의 비공개 주소(.ics)'를 넣어 주세요." };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: "https://로 시작하는 Google 캘린더 iCal(.ics) 주소를 입력해 주세요." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, message: "https://로 시작하는 Google 캘린더 iCal(.ics) 주소를 입력해 주세요." };
  }
  const isGoogleIcal = url.hostname === "calendar.google.com" && GOOGLE_ICAL_PATH_RE.test(url.pathname);
  const isIcsPath = /\.ics$/i.test(url.pathname);
  if (!isGoogleIcal && !isIcsPath) {
    return { ok: false, message: "https://로 시작하는 Google 캘린더 iCal(.ics) 주소를 입력해 주세요." };
  }
  return { ok: true, url: url.toString() };
}

export function parseProxyUrlInput(input: string): { ok: true; url: string | null } | { ok: false; message: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: true, url: null };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: "https://로 시작하는 프록시 주소를 입력해 주세요." };
  }
  const isLocalHttp = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    return { ok: false, message: "https://로 시작하는 프록시 주소를 입력해 주세요." };
  }
  return { ok: true, url: url.toString() };
}

export function buildProxyRequestURL(proxyUrl: string, icsUrl: string): string {
  const url = new URL(proxyUrl);
  url.searchParams.set("url", icsUrl);
  return url.toString();
}

function shortenCalendarId(id: string): string {
  const atIndex = id.indexOf("@");
  if (atIndex <= 14) return id;
  return `${id.slice(0, 12)}…${id.slice(atIndex)}`;
}

/** 비밀 토큰(`/private-.../`)이 화면에 노출되지 않도록 iCal 주소를 가려 줍니다. */
export function maskCalendarUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  const match = url.pathname.match(GOOGLE_ICAL_PATH_RE);
  if (match && match[1]) {
    let decodedId = match[1];
    try {
      decodedId = decodeURIComponent(match[1]);
    } catch {
      // 디코딩할 수 없으면 원문을 씁니다.
    }
    const isPrivate = /\/private-[^/]+\//i.test(url.pathname);
    const shortId = shortenCalendarId(decodedId);
    return isPrivate ? `${shortId} (비공개)` : shortId;
  }
  return url.hostname;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDayKey(day: DayDate): string {
  return `${String(day.year).padStart(4, "0")}-${pad2(day.month)}-${pad2(day.day)}`;
}

export function calendarSignature(calendars: ChildCalendar[]): string {
  return calendars.map((c) => `${c.url}\t${c.label}\t${c.color ?? ""}`).join("\n");
}

function formatMinutes(min: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function formatEventTime(event: CalendarEvent): string {
  if (event.allDay || event.startMin === null) return "종일";
  const start = formatMinutes(event.startMin);
  if (event.endMin !== null && event.endMin > event.startMin) {
    return `${start}–${formatMinutes(event.endMin)}`;
  }
  return start;
}

export type EventStatus = "allDay" | "past" | "ongoing" | "next" | "upcoming";

export interface ClassifiedCalendarEvent {
  event: CalendarEvent;
  status: EventStatus;
}

function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (!a.allDay && !b.allDay) {
    const aStart = a.startMin ?? 0;
    const bStart = b.startMin ?? 0;
    if (aStart !== bStart) return aStart - bStart;
    const aEnd = a.endMin ?? aStart;
    const bEnd = b.endMin ?? bStart;
    if (aEnd !== bEnd) return aEnd - bEnd;
  }
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}

/** 오늘 일정을 시간순으로 정렬하고 현재 시각 기준 상태(종일·지남·진행 중·다음·예정)를 매깁니다. */
export function classifyTodayEvents(events: CalendarEvent[], now: Date): ClassifiedCalendarEvent[] {
  const sorted = events.slice().sort(compareEvents);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let nextStartMin: number | null = null;
  for (const ev of sorted) {
    if (ev.allDay || ev.startMin === null) continue;
    if (ev.startMin > nowMin) {
      nextStartMin = ev.startMin;
      break;
    }
  }

  return sorted.map((ev) => {
    if (ev.allDay || ev.startMin === null) {
      return { event: ev, status: "allDay" };
    }
    const effectiveEnd = ev.endMin !== null && ev.endMin > ev.startMin ? ev.endMin : ev.startMin + 1;
    if (nowMin >= ev.startMin && nowMin < effectiveEnd) {
      return { event: ev, status: "ongoing" };
    }
    if (nowMin >= effectiveEnd) {
      return { event: ev, status: "past" };
    }
    if (nextStartMin !== null && ev.startMin === nextStartMin) {
      return { event: ev, status: "next" };
    }
    return { event: ev, status: "upcoming" };
  });
}
