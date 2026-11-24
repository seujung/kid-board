import { expect, test } from "vitest";
import {
  buildProxyRequestURL,
  classifyTodayEvents,
  formatDayKey,
  formatEventTime,
  maskCalendarUrl,
  parseIcalUrlInput,
  parseProxyUrlInput,
} from "../../src/core/calendar";
import type { CalendarEvent } from "../../src/core/domain";
import { at } from "../support";

const PRIVATE_ICAL =
  "https://calendar.google.com/calendar/ical/15ba96fff7869d387b82de14901466134c4291a0c3f7523411471c4e1cbd16ce%40group.calendar.google.com/private-abc123secret/basic.ics";

test("parsesValidGoogleIcalUrlsAndRejectsIframeOrNonHttps", () => {
  expect(parseIcalUrlInput(PRIVATE_ICAL)).toEqual({ ok: true, url: PRIVATE_ICAL });
  expect(
    parseIcalUrlInput("https://calendar.google.com/calendar/ical/kid%40gmail.com/public/basic.ics"),
  ).toEqual({
    ok: true,
    url: "https://calendar.google.com/calendar/ical/kid%40gmail.com/public/basic.ics",
  });

  expect(parseIcalUrlInput("")).toMatchObject({ ok: false });
  expect(parseIcalUrlInput('<iframe src="https://calendar.google.com/calendar/embed?src=a"></iframe>')).toMatchObject({
    ok: false,
  });
  expect(parseIcalUrlInput("http://calendar.google.com/calendar/ical/a/public/basic.ics")).toMatchObject({
    ok: false,
  });
  expect(parseIcalUrlInput("https://example.com/calendar")).toMatchObject({ ok: false });
});

test("parsesProxyUrlAndBuildsRequestUrl", () => {
  expect(parseProxyUrlInput("")).toEqual({ ok: true, url: null });
  expect(parseProxyUrlInput("https://script.google.com/macros/s/abc/exec")).toEqual({
    ok: true,
    url: "https://script.google.com/macros/s/abc/exec",
  });
  expect(parseProxyUrlInput("http://localhost:8787/ics")).toEqual({
    ok: true,
    url: "http://localhost:8787/ics",
  });
  expect(parseProxyUrlInput("http://evil.example.com/proxy")).toMatchObject({ ok: false });

  const built = buildProxyRequestURL("https://script.google.com/macros/s/abc/exec", PRIVATE_ICAL);
  expect(new URL(built).searchParams.get("url")).toBe(PRIVATE_ICAL);
});

test("masksSecretTokenInCalendarUrl", () => {
  const masked = maskCalendarUrl(PRIVATE_ICAL);
  expect(masked).toBe("15ba96fff786…@group.calendar.google.com (비공개)");
  expect(masked).not.toContain("private-abc123secret");
  expect(maskCalendarUrl("https://calendar.google.com/calendar/ical/school%40group.calendar.google.com/public/basic.ics")).toBe(
    "school@group.calendar.google.com",
  );
});

test("classifiesAndSortsTodayEventsByCurrentTime", () => {
  const events: CalendarEvent[] = [
    { id: "1", title: "저녁 수영", allDay: false, startMin: 18 * 60, endMin: 19 * 60, calendarLabel: "학원", calendarColor: null },
    { id: "2", title: "등교 준비", allDay: false, startMin: 8 * 60, endMin: 8 * 60 + 30, calendarLabel: "학교", calendarColor: null },
    { id: "3", title: "피아노", allDay: false, startMin: 15 * 60, endMin: 16 * 60, calendarLabel: "학원", calendarColor: null },
    { id: "4", title: "영어", allDay: false, startMin: 16 * 60 + 30, endMin: 17 * 60 + 30, calendarLabel: "학원", calendarColor: null },
    { id: "5", title: "현장학습", allDay: true, startMin: null, endMin: null, calendarLabel: "학교", calendarColor: null },
  ];

  // 현재 15:20: 현장학습(allDay), 등교 준비(past), 피아노(ongoing), 영어(next), 저녁 수영(upcoming)
  const classified = classifyTodayEvents(events, at(2026, 11, 24, 15, 20));
  expect(classified.map((c) => [c.event.title, c.status])).toEqual([
    ["현장학습", "allDay"],
    ["등교 준비", "past"],
    ["피아노", "ongoing"],
    ["영어", "next"],
    ["저녁 수영", "upcoming"],
  ]);

  expect(formatEventTime(events[4]!)).toBe("종일");
  expect(formatEventTime(events[2]!)).toBe("15:00–16:00");
  expect(formatDayKey({ year: 2026, month: 1, day: 5 })).toBe("2026-01-05");
});
