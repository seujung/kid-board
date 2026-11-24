import type { DayDate } from "./dayDate";
import type { ChildCalendar } from "./domain";

export const DEFAULT_CALENDAR_TZ = "Asia/Seoul";
export const CALENDAR_EMBED_BASE = "https://calendar.google.com/calendar/embed";
export const CALENDAR_REFRESH_MS = 1_800_000;

export interface ParsedCalendarEntry {
  src: string;
  ctz: string;
  color: string | null;
}

export type ParseCalendarResult =
  | { ok: true; entries: ParsedCalendarEntry[] }
  | { ok: false; message: string };

const TZ_RE = /^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/;
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const IFRAME_TAG_RE = /<iframe\b/i;
const IFRAME_SRC_RE = /\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i;
const EMBED_PATH_RE = /^\/calendar(?:\/u\/\d+)?\/embed\/?$/i;
const ICAL_PATH_RE = /^\/calendar\/ical\/([^/]+)\//i;
const BARE_ID_RE = /^[^\s<>@"'&]+@[^\s<>@"'&]+\.[^\s<>@"'&]+$/;

export function normalizeTimezone(raw: string | null | undefined): string {
  if (typeof raw !== "string") return DEFAULT_CALENDAR_TZ;
  const trimmed = raw.trim();
  return TZ_RE.test(trimmed) ? trimmed : DEFAULT_CALENDAR_TZ;
}

export function normalizeHexColor(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toUpperCase() : null;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatYMD(day: DayDate): string {
  return `${String(day.year).padStart(4, "0")}${pad2(day.month)}${pad2(day.day)}`;
}

function decodeHtmlAmp(value: string): string {
  return value.replace(/&amp;|&#38;|&#x26;/gi, "&").trim();
}

function parseCalendarURL(rawUrl: string): ParseCalendarResult {
  let url: URL;
  try {
    url = new URL(decodeHtmlAmp(rawUrl));
  } catch {
    return { ok: false, message: "캘린더 주소 형식이 올바르지 않아요." };
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname !== "calendar.google.com") {
    return { ok: false, message: "Google 캘린더 주소(calendar.google.com)만 등록할 수 있어요." };
  }

  if (EMBED_PATH_RE.test(url.pathname)) {
    const ctz = normalizeTimezone(url.searchParams.get("ctz"));
    const entries: ParsedCalendarEntry[] = [];
    const seen = new Set<string>();
    let lastAdded: ParsedCalendarEntry | null = null;
    url.searchParams.forEach((value, key) => {
      if (key === "src") {
        const src = value.trim();
        if (!src || seen.has(src)) {
          lastAdded = null;
          return;
        }
        seen.add(src);
        const entry: ParsedCalendarEntry = { src, ctz, color: null };
        entries.push(entry);
        lastAdded = entry;
      } else if (key === "color" && lastAdded !== null && lastAdded.color === null) {
        lastAdded.color = normalizeHexColor(value);
      }
    });
    if (entries.length === 0) {
      return { ok: false, message: "캘린더 주소에 src 값이 없어요." };
    }
    return { ok: true, entries };
  }

  const icalMatch = url.pathname.match(ICAL_PATH_RE);
  if (icalMatch && icalMatch[1]) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(icalMatch[1]).trim();
    } catch {
      return { ok: false, message: "캘린더 주소 형식이 올바르지 않아요." };
    }
    if (!decoded) {
      return { ok: false, message: "캘린더 주소에 src 값이 없어요." };
    }
    return { ok: true, entries: [{ src: decoded, ctz: DEFAULT_CALENDAR_TZ, color: null }] };
  }

  return { ok: false, message: "Google 캘린더 퍼가기(embed) 코드를 넣어 주세요." };
}

/** 사용자가 붙여 넣은 Google 캘린더 iframe 코드, URL 또는 캘린더 ID를 파싱합니다. */
export function parseCalendarInput(input: string): ParseCalendarResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, message: "구글 캘린더 iframe 코드나 주소를 입력해 주세요." };
  }
  if (IFRAME_TAG_RE.test(trimmed)) {
    const match = trimmed.match(IFRAME_SRC_RE);
    const srcAttr = match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
    if (!srcAttr.trim()) {
      return { ok: false, message: "iframe 코드에서 src 주소를 찾을 수 없어요." };
    }
    return parseCalendarURL(srcAttr);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return parseCalendarURL(trimmed);
  }
  if (BARE_ID_RE.test(trimmed)) {
    return { ok: true, entries: [{ src: trimmed, ctz: DEFAULT_CALENDAR_TZ, color: null }] };
  }
  return { ok: false, message: "Google 캘린더 iframe 코드나 주소를 넣어 주세요." };
}

/** 등록된 캘린더 목록과 날짜로 오늘 일정만 표시하는 Google Calendar AGENDA 임베드 URL을 만듭니다. */
export function buildTodayAgendaEmbedURL(calendars: ChildCalendar[], day: DayDate): string | null {
  if (calendars.length === 0) return null;
  const ymd = formatYMD(day);
  const params = new URLSearchParams();
  params.set("mode", "AGENDA");
  params.set("dates", `${ymd}/${ymd}`);
  params.set("ctz", normalizeTimezone(calendars[0]!.ctz));
  params.set("hl", "ko");
  params.set("wkst", "1");
  params.set("showTitle", "0");
  params.set("showNav", "0");
  params.set("showDate", "0");
  params.set("showPrint", "0");
  params.set("showTabs", "0");
  params.set("showCalendars", "0");
  params.set("showTz", "0");
  for (const cal of calendars) {
    params.append("src", cal.src);
    const color = normalizeHexColor(cal.color);
    if (color) params.append("color", color);
  }
  return `${CALENDAR_EMBED_BASE}?${params.toString()}`;
}

/** 긴 Google Calendar ID를 부모 모드에서 읽기 쉽게 줄입니다. */
export function shortCalendarSrc(src: string): string {
  const atIndex = src.indexOf("@");
  if (atIndex <= 14) return src;
  return `${src.slice(0, 12)}…${src.slice(atIndex)}`;
}
