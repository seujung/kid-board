import type { DayDate } from "./dayDate";
import type { CalendarEvent } from "./domain";

export interface CalendarMeta {
  label: string;
  color: string | null;
}

interface ParsedDateTime {
  allDay: boolean;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  utc: boolean;
  tzid: string | null;
  ms: number;
}

interface RawVEvent {
  uid: string;
  summary: string;
  status: string;
  dtstart: ParsedDateTime | null;
  dtend: ParsedDateTime | null;
  durationMs: number | null;
  rrule: string | null;
  exdates: ParsedDateTime[];
  recurrenceId: ParsedDateTime | null;
}

const MAX_OCCURRENCES = 20_000;
const DAY_MS = 86_400_000;
const WEEKDAY_TOKENS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

function unfoldLines(icsText: string): string[] {
  const normalized = icsText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
  return normalized.split("\n");
}

function unescapeIcsText(value: string): string {
  return value.replace(/\\([\\,;nN])/g, (_, ch: string) => (ch === "n" || ch === "N" ? "\n" : ch));
}

function splitPropertyLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  let inQuotes = false;
  let colonIdx = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) {
      colonIdx = i;
      break;
    }
  }
  if (colonIdx <= 0) return null;

  const head = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const parts: string[] = [];
  let start = 0;
  inQuotes = false;
  for (let i = 0; i <= head.length; i++) {
    const ch = head[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if ((ch === ";" && !inQuotes) || i === head.length) {
      parts.push(head.slice(start, i));
      start = i + 1;
    }
  }

  const name = (parts[0] ?? "").trim().toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const pName = part.slice(0, eq).trim().toUpperCase();
    let pVal = part.slice(eq + 1).trim();
    if (pVal.length >= 2 && pVal[0] === '"' && pVal[pVal.length - 1] === '"') {
      pVal = pVal.slice(1, -1);
    }
    params[pName] = pVal;
  }
  return { name, params, value };
}

function tzPartsToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tzid: string,
): number | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tzid,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const guessUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const readZoneWall = (ms: number): number => {
      const parts = fmt.formatToParts(new Date(ms));
      const get = (type: string) => {
        const found = parts.find((p) => p.type === type);
        return found ? Number(found.value) : 0;
      };
      const h = get("hour") === 24 ? 0 : get("hour");
      return Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));
    };
    const diff1 = readZoneWall(guessUtc) - guessUtc;
    const refined = guessUtc - diff1;
    const diff2 = readZoneWall(refined) - refined;
    return guessUtc - diff2;
  } catch {
    return null;
  }
}

function parseIcsDateTime(rawValue: string, params: Record<string, string>): ParsedDateTime | null {
  const value = rawValue.trim();
  const isDateOnly = params.VALUE?.toUpperCase() === "DATE" || /^\d{8}$/.test(value);
  if (isDateOnly) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    return {
      allDay: true,
      year,
      month,
      day,
      hour: 0,
      minute: 0,
      second: 0,
      utc: false,
      tzid: null,
      ms: new Date(year, month - 1, day, 0, 0, 0, 0).getTime(),
    };
  }

  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/i);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  const utc = Boolean(m[7]);
  const tzid = params.TZID ?? null;

  let ms: number;
  if (utc) {
    ms = Date.UTC(year, month - 1, day, hour, minute, second);
  } else if (tzid && tzid !== "Asia/Seoul") {
    const converted = tzPartsToUtcMs(year, month, day, hour, minute, second, tzid);
    ms = converted ?? new Date(year, month - 1, day, hour, minute, second, 0).getTime();
  } else {
    ms = new Date(year, month - 1, day, hour, minute, second, 0).getTime();
  }

  return { allDay: false, year, month, day, hour, minute, second, utc, tzid, ms };
}

function parseDurationMs(rawValue: string): number | null {
  const m = rawValue.trim().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  if (m[1] === "-") return 0;
  const weeks = Number(m[2] ?? 0);
  const days = Number(m[3] ?? 0);
  const hours = Number(m[4] ?? 0);
  const minutes = Number(m[5] ?? 0);
  const seconds = Number(m[6] ?? 0);
  return (((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60_000 + seconds * 1000;
}

function parseVEvents(icsText: string): RawVEvent[] {
  const lines = unfoldLines(icsText);
  const events: RawVEvent[] = [];
  let current: RawVEvent | null = null;
  let subDepth = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const upper = line.trim().toUpperCase();
    if (current === null) {
      if (upper === "BEGIN:VEVENT") {
        current = {
          uid: "",
          summary: "",
          status: "",
          dtstart: null,
          dtend: null,
          durationMs: null,
          rrule: null,
          exdates: [],
          recurrenceId: null,
        };
        subDepth = 0;
      }
      continue;
    }

    if (upper.indexOf("BEGIN:") === 0) {
      subDepth += 1;
      continue;
    }
    if (upper.indexOf("END:") === 0) {
      if (subDepth > 0) {
        subDepth -= 1;
        continue;
      }
      if (upper === "END:VEVENT") {
        events.push(current);
        current = null;
      }
      continue;
    }
    if (subDepth > 0) continue;

    const prop = splitPropertyLine(line);
    if (!prop) continue;

    switch (prop.name) {
      case "UID":
        current.uid = prop.value.trim();
        break;
      case "SUMMARY":
        current.summary = unescapeIcsText(prop.value).trim();
        break;
      case "STATUS":
        current.status = prop.value.trim().toUpperCase();
        break;
      case "DTSTART":
        current.dtstart = parseIcsDateTime(prop.value, prop.params);
        break;
      case "DTEND":
        current.dtend = parseIcsDateTime(prop.value, prop.params);
        break;
      case "DURATION":
        current.durationMs = parseDurationMs(prop.value);
        break;
      case "RRULE":
        current.rrule = prop.value.trim();
        break;
      case "EXDATE":
        for (const token of prop.value.split(",")) {
          const parsed = parseIcsDateTime(token, prop.params);
          if (parsed) current.exdates.push(parsed);
        }
        break;
      case "RECURRENCE-ID":
        current.recurrenceId = parseIcsDateTime(prop.value, prop.params);
        break;
    }
  }

  return events;
}

interface ByDayRule {
  ord: number | null;
  weekday: number; // 0=SU..6=SA
}

interface RRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count: number | null;
  untilMs: number | null;
  byDay: ByDayRule[];
  byMonthDay: number[];
  byMonth: number[];
  wkst: number; // 0=SU..6=SA
}

function parseWeekdayToken(token: string): number | null {
  const idx = WEEKDAY_TOKENS.indexOf(token as (typeof WEEKDAY_TOKENS)[number]);
  return idx >= 0 ? idx : null;
}

function parseRRule(raw: string): RRule | null {
  const parts: Record<string, string> = {};
  for (const item of raw.split(";")) {
    const eq = item.indexOf("=");
    if (eq <= 0) continue;
    parts[item.slice(0, eq).trim().toUpperCase()] = item.slice(eq + 1).trim();
  }
  const freq = parts.FREQ?.toUpperCase();
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null;

  const intervalRaw = Number(parts.INTERVAL ?? "1");
  const interval = Number.isFinite(intervalRaw) && intervalRaw >= 1 ? Math.floor(intervalRaw) : 1;

  const countRaw = parts.COUNT !== undefined ? Number(parts.COUNT) : NaN;
  const count = Number.isFinite(countRaw) && countRaw >= 1 ? Math.floor(countRaw) : null;

  let untilMs: number | null = null;
  if (parts.UNTIL) {
    const parsedUntil = parseIcsDateTime(parts.UNTIL, {});
    if (parsedUntil) {
      untilMs = parsedUntil.allDay
        ? new Date(parsedUntil.year, parsedUntil.month - 1, parsedUntil.day, 23, 59, 59, 999).getTime()
        : parsedUntil.ms;
    }
  }

  const byDay: ByDayRule[] = [];
  if (parts.BYDAY) {
    for (const token of parts.BYDAY.split(",")) {
      const m = token.trim().toUpperCase().match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
      if (!m) continue;
      const weekday = parseWeekdayToken(m[2]!);
      if (weekday === null) continue;
      const ord = m[1] ? Number(m[1]) : null;
      byDay.push({ ord: ord !== null && Number.isFinite(ord) ? ord : null, weekday });
    }
  }

  const byMonthDay: number[] = [];
  if (parts.BYMONTHDAY) {
    for (const token of parts.BYMONTHDAY.split(",")) {
      const n = Number(token.trim());
      if (Number.isFinite(n) && n !== 0 && Math.abs(n) <= 31) byMonthDay.push(Math.trunc(n));
    }
  }

  const byMonth: number[] = [];
  if (parts.BYMONTH) {
    for (const token of parts.BYMONTH.split(",")) {
      const n = Number(token.trim());
      if (Number.isFinite(n) && n >= 1 && n <= 12) byMonth.push(Math.trunc(n));
    }
  }

  const wkst = parseWeekdayToken(parts.WKST?.toUpperCase() ?? "MO") ?? 1;
  return { freq, interval, count, untilMs, byDay, byMonthDay, byMonth, wkst };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function occurrenceMsFromCalendarDate(year: number, month: number, day: number, dtstart: ParsedDateTime): number {
  if (dtstart.allDay) {
    return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  }
  if (dtstart.utc) {
    return Date.UTC(year, month - 1, day, dtstart.hour, dtstart.minute, dtstart.second);
  }
  if (dtstart.tzid && dtstart.tzid !== "Asia/Seoul") {
    const converted = tzPartsToUtcMs(year, month, day, dtstart.hour, dtstart.minute, dtstart.second, dtstart.tzid);
    if (converted !== null) return converted;
  }
  return new Date(year, month - 1, day, dtstart.hour, dtstart.minute, dtstart.second, 0).getTime();
}

function resolveMonthDays(year: number, month: number, rule: RRule, defaultDay: number): number[] {
  const totalDays = daysInMonth(year, month);
  if (rule.byDay.length > 0) {
    const set = new Set<number>();
    for (const bd of rule.byDay) {
      const matching: number[] = [];
      for (let d = 1; d <= totalDays; d++) {
        if (new Date(year, month - 1, d).getDay() === bd.weekday) matching.push(d);
      }
      if (bd.ord === null) {
        for (const d of matching) set.add(d);
      } else if (bd.ord > 0 && bd.ord <= matching.length) {
        set.add(matching[bd.ord - 1]!);
      } else if (bd.ord < 0) {
        const idx = matching.length + bd.ord;
        if (idx >= 0 && idx < matching.length) set.add(matching[idx]!);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }
  if (rule.byMonthDay.length > 0) {
    const set = new Set<number>();
    for (const md of rule.byMonthDay) {
      const resolved = md > 0 ? md : totalDays + 1 + md;
      if (resolved >= 1 && resolved <= totalDays) set.add(resolved);
    }
    return Array.from(set).sort((a, b) => a - b);
  }
  return defaultDay <= totalDays ? [defaultDay] : [];
}

function expandOccurrenceStarts(dtstart: ParsedDateTime, rule: RRule, windowEndMs: number): number[] {
  const results: number[] = [];
  const limitMs = rule.untilMs !== null ? Math.min(windowEndMs, rule.untilMs) : windowEndMs;
  if (dtstart.ms > limitMs) return results;

  const pushIfInRange = (ms: number): "ok" | "stop" => {
    if (ms < dtstart.ms) return "ok";
    if (ms > limitMs) return "stop";
    results.push(ms);
    if (rule.count !== null && results.length >= rule.count) return "stop";
    if (results.length >= MAX_OCCURRENCES) return "stop";
    return "ok";
  };

  if (rule.freq === "DAILY") {
    let dayOffset = 0;
    for (let iter = 0; iter < MAX_OCCURRENCES; iter++) {
      const candidate = new Date(dtstart.year, dtstart.month - 1, dtstart.day + dayOffset);
      const y = candidate.getFullYear();
      const m = candidate.getMonth() + 1;
      const d = candidate.getDate();
      const ms = occurrenceMsFromCalendarDate(y, m, d, dtstart);
      if (ms > limitMs) break;
      const monthOk = rule.byMonth.length === 0 || rule.byMonth.indexOf(m) >= 0;
      const dayOk =
        rule.byDay.length === 0 || rule.byDay.some((bd) => bd.weekday === candidate.getDay());
      const mdOk =
        rule.byMonthDay.length === 0 ||
        rule.byMonthDay.some((md) => (md > 0 ? md === d : daysInMonth(y, m) + 1 + md === d));
      if (monthOk && dayOk && mdOk && pushIfInRange(ms) === "stop") break;
      dayOffset += rule.interval;
    }
    return results;
  }

  if (rule.freq === "WEEKLY") {
    const startDate = new Date(dtstart.year, dtstart.month - 1, dtstart.day);
    const startWeekday = startDate.getDay();
    const diffToWkst = (startWeekday - rule.wkst + 7) % 7;
    const weekBaseDay = dtstart.day - diffToWkst;
    const targetDays =
      rule.byDay.length > 0
        ? Array.from(new Set(rule.byDay.map((bd) => bd.weekday))).sort(
            (a, b) => ((a - rule.wkst + 7) % 7) - ((b - rule.wkst + 7) % 7),
          )
        : [startWeekday];

    let weekIndex = 0;
    for (let iter = 0; iter < MAX_OCCURRENCES; iter++) {
      let stopped = false;
      for (const wd of targetDays) {
        const offset = (wd - rule.wkst + 7) % 7;
        const candidate = new Date(dtstart.year, dtstart.month - 1, weekBaseDay + weekIndex * 7 + offset);
        const ms = occurrenceMsFromCalendarDate(
          candidate.getFullYear(),
          candidate.getMonth() + 1,
          candidate.getDate(),
          dtstart,
        );
        if (ms > limitMs) {
          stopped = true;
          break;
        }
        const monthOk = rule.byMonth.length === 0 || rule.byMonth.indexOf(candidate.getMonth() + 1) >= 0;
        if (monthOk && pushIfInRange(ms) === "stop") {
          stopped = true;
          break;
        }
      }
      if (stopped) break;
      weekIndex += rule.interval;
    }
    return results;
  }

  if (rule.freq === "MONTHLY") {
    let monthOffset = 0;
    for (let iter = 0; iter < MAX_OCCURRENCES; iter++) {
      const base = new Date(dtstart.year, dtstart.month - 1 + monthOffset, 1);
      const y = base.getFullYear();
      const m = base.getMonth() + 1;
      if (occurrenceMsFromCalendarDate(y, m, 1, dtstart) > limitMs) break;
      if (rule.byMonth.length === 0 || rule.byMonth.indexOf(m) >= 0) {
        const days = resolveMonthDays(y, m, rule, dtstart.day);
        let stopped = false;
        for (const d of days) {
          if (pushIfInRange(occurrenceMsFromCalendarDate(y, m, d, dtstart)) === "stop") {
            stopped = true;
            break;
          }
        }
        if (stopped) break;
      }
      monthOffset += rule.interval;
    }
    return results;
  }

  // YEARLY
  let yearOffset = 0;
  for (let iter = 0; iter < MAX_OCCURRENCES; iter++) {
    const y = dtstart.year + yearOffset;
    if (occurrenceMsFromCalendarDate(y, 1, 1, dtstart) > limitMs) break;
    const months =
      rule.byMonth.length > 0 ? Array.from(new Set(rule.byMonth)).sort((a, b) => a - b) : [dtstart.month];
    let stopped = false;
    for (const m of months) {
      const days = resolveMonthDays(y, m, rule, dtstart.day);
      for (const d of days) {
        if (pushIfInRange(occurrenceMsFromCalendarDate(y, m, d, dtstart)) === "stop") {
          stopped = true;
          break;
        }
      }
      if (stopped) break;
    }
    if (stopped) break;
    yearOffset += rule.interval;
  }
  return results;
}

function dateKeyOfMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function eventOverlapsDay(
  allDay: boolean,
  startMs: number,
  endMs: number,
  dayStartMs: number,
  dayEndMs: number,
): boolean {
  if (allDay) {
    const effectiveEnd = endMs > startMs ? endMs : startMs + DAY_MS;
    return startMs < dayEndMs && effectiveEnd > dayStartMs;
  }
  if (endMs > startMs) {
    return startMs < dayEndMs && endMs > dayStartMs;
  }
  return startMs >= dayStartMs && startMs < dayEndMs;
}

function toCalendarEvent(
  id: string,
  ev: RawVEvent,
  startMs: number,
  endMs: number,
  dayStartMs: number,
  dayEndMs: number,
  meta: CalendarMeta,
): CalendarEvent {
  const title = ev.summary || "(제목 없음)";
  if (ev.dtstart!.allDay) {
    return {
      id,
      title,
      allDay: true,
      startMin: null,
      endMin: null,
      calendarLabel: meta.label,
      calendarColor: meta.color,
    };
  }
  const clampedStart = Math.max(dayStartMs, Math.min(dayEndMs, startMs));
  const clampedEnd = Math.max(clampedStart, Math.min(dayEndMs, endMs > startMs ? endMs : startMs));
  const startMin = Math.round((clampedStart - dayStartMs) / 60_000);
  const endMin = Math.round((clampedEnd - dayStartMs) / 60_000);
  if (startMin === 0 && endMin >= 1440) {
    return {
      id,
      title,
      allDay: true,
      startMin: null,
      endMin: null,
      calendarLabel: meta.label,
      calendarColor: meta.color,
    };
  }
  return {
    id,
    title,
    allDay: false,
    startMin,
    endMin,
    calendarLabel: meta.label,
    calendarColor: meta.color,
  };
}

/** iCalendar(.ics) 텍스트에서 `targetDay`와 겹치는 오늘 일정 목록을 추출합니다. */
export function parseIcsEventsForDay(icsText: string, targetDay: DayDate, meta: CalendarMeta): CalendarEvent[] {
  const rawEvents = parseVEvents(icsText);
  const dayStartMs = new Date(targetDay.year, targetDay.month - 1, targetDay.day, 0, 0, 0, 0).getTime();
  const dayEndMs = new Date(targetDay.year, targetDay.month - 1, targetDay.day + 1, 0, 0, 0, 0).getTime();

  const overrideMsByUid = new Map<string, Set<number>>();
  const overrideDayKeyByUid = new Map<string, Set<string>>();
  for (const ev of rawEvents) {
    if (!ev.uid || !ev.recurrenceId) continue;
    let msSet = overrideMsByUid.get(ev.uid);
    if (!msSet) {
      msSet = new Set<number>();
      overrideMsByUid.set(ev.uid, msSet);
    }
    msSet.add(ev.recurrenceId.ms);
    if (ev.recurrenceId.allDay) {
      let daySet = overrideDayKeyByUid.get(ev.uid);
      if (!daySet) {
        daySet = new Set<string>();
        overrideDayKeyByUid.set(ev.uid, daySet);
      }
      daySet.add(dateKeyOfMs(ev.recurrenceId.ms));
    }
  }

  const out: CalendarEvent[] = [];
  const seenIds = new Set<string>();

  const pushUnique = (item: CalendarEvent) => {
    if (seenIds.has(item.id)) return;
    seenIds.add(item.id);
    out.push(item);
  };

  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i]!;
    if (!ev.dtstart) continue;
    if (ev.status === "CANCELLED") continue;

    const baseStart = ev.dtstart.ms;
    const baseEnd = ev.dtend
      ? ev.dtend.ms
      : ev.durationMs !== null
        ? baseStart + ev.durationMs
        : ev.dtstart.allDay
          ? new Date(ev.dtstart.year, ev.dtstart.month - 1, ev.dtstart.day + 1, 0, 0, 0, 0).getTime()
          : baseStart;
    const durationMs = Math.max(0, baseEnd - baseStart);
    const uid = ev.uid || `idx-${i}`;

    if (ev.recurrenceId || !ev.rrule) {
      const exExcluded = ev.exdates.some((ex) =>
        ev.dtstart!.allDay ? dateKeyOfMs(ex.ms) === dateKeyOfMs(baseStart) : ex.ms === baseStart,
      );
      if (exExcluded) continue;
      if (eventOverlapsDay(ev.dtstart.allDay, baseStart, baseEnd, dayStartMs, dayEndMs)) {
        const id = ev.recurrenceId ? `${uid}#${ev.recurrenceId.ms}` : `${uid}#${baseStart}`;
        pushUnique(toCalendarEvent(id, ev, baseStart, baseEnd, dayStartMs, dayEndMs, meta));
      }
      continue;
    }

    const rule = parseRRule(ev.rrule);
    if (!rule) continue;
    const starts = expandOccurrenceStarts(ev.dtstart, rule, dayEndMs - 1);
    const exMs = new Set(ev.exdates.map((ex) => ex.ms));
    const exDays = new Set(ev.exdates.filter((ex) => ex.allDay).map((ex) => dateKeyOfMs(ex.ms)));
    const ovMs = overrideMsByUid.get(uid);
    const ovDays = overrideDayKeyByUid.get(uid);

    for (const occStart of starts) {
      const dayKey = dateKeyOfMs(occStart);
      if (exMs.has(occStart) || (ev.dtstart.allDay && exDays.has(dayKey))) continue;
      if (ovMs?.has(occStart) || (ev.dtstart.allDay && ovDays?.has(dayKey))) continue;
      const occEnd = occStart + durationMs;
      if (eventOverlapsDay(ev.dtstart.allDay, occStart, occEnd, dayStartMs, dayEndMs)) {
        pushUnique(toCalendarEvent(`${uid}#${occStart}`, ev, occStart, occEnd, dayStartMs, dayEndMs, meta));
      }
    }
  }

  return out;
}
