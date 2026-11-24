import { expect, test } from "vitest";
import {
  buildTodayAgendaEmbedURL,
  DEFAULT_CALENDAR_TZ,
  formatYMD,
  parseCalendarInput,
  shortCalendarSrc,
} from "../../src/core/calendar";
import type { ChildCalendar } from "../../src/core/domain";

const SAMPLE_IFRAME =
  '<iframe src="https://calendar.google.com/calendar/embed?src=15ba96fff7869d387b82de14901466134c4291a0c3f7523411471c4e1cbd16ce%40group.calendar.google.com&ctz=Asia%2FSeoul" style="border: 0" width="800" height="600" frameborder="0" scrolling="no"></iframe>';

const SAMPLE_ID = "15ba96fff7869d387b82de14901466134c4291a0c3f7523411471c4e1cbd16ce@group.calendar.google.com";

test("parsesGoogleCalendarIframeSnippet", () => {
  const res = parseCalendarInput(SAMPLE_IFRAME);
  expect(res).toEqual({
    ok: true,
    entries: [{ src: SAMPLE_ID, ctz: "Asia/Seoul", color: null }],
  });
});

test("parsesHtmlEncodedAmpersandsAndSingleQuotes", () => {
  const html = `<iframe src='https://calendar.google.com/calendar/embed?src=school%40group.calendar.google.com&amp;ctz=America%2FNew_York&amp;color=%23039be5'></iframe>`;
  expect(parseCalendarInput(html)).toEqual({
    ok: true,
    entries: [{ src: "school@group.calendar.google.com", ctz: "America/New_York", color: "#039BE5" }],
  });
});

test("parsesMultipleSrcsAndColorsFromSingleEmbed", () => {
  const url =
    "https://calendar.google.com/calendar/embed?ctz=Asia%2FSeoul&src=a%40group.calendar.google.com&color=%23d50000&src=b%40group.calendar.google.com&color=%230b8043&src=a%40group.calendar.google.com";
  expect(parseCalendarInput(url)).toEqual({
    ok: true,
    entries: [
      { src: "a@group.calendar.google.com", ctz: "Asia/Seoul", color: "#D50000" },
      { src: "b@group.calendar.google.com", ctz: "Asia/Seoul", color: "#0B8043" },
    ],
  });
});

test("parsesIcalUrlAndBareCalendarId", () => {
  expect(parseCalendarInput("https://calendar.google.com/calendar/ical/kid%40group.calendar.google.com/public/basic.ics")).toEqual({
    ok: true,
    entries: [{ src: "kid@group.calendar.google.com", ctz: DEFAULT_CALENDAR_TZ, color: null }],
  });
  expect(parseCalendarInput("kid@group.calendar.google.com")).toEqual({
    ok: true,
    entries: [{ src: "kid@group.calendar.google.com", ctz: DEFAULT_CALENDAR_TZ, color: null }],
  });
});

test("rejectsInvalidCalendarInputs", () => {
  const bad = [
    "",
    "   ",
    "<iframe></iframe>",
    '<iframe src="https://evil.com/calendar/embed?src=a@b.com"></iframe>',
    '<iframe src="javascript:alert(1)"></iframe>',
    "https://calendar.google.com/calendar/embed?ctz=Asia%2FSeoul",
    "https://calendar.google.com/calendar/u/0/r",
    "not a calendar",
  ];
  for (const input of bad) {
    expect(parseCalendarInput(input).ok).toBe(false);
  }
});

test("buildsTodayAgendaEmbedUrlForMultipleCalendarsAndUpdatesOnDateChange", () => {
  expect(buildTodayAgendaEmbedURL([], { year: 2026, month: 11, day: 24 })).toBeNull();

  const calendars: ChildCalendar[] = [
    { id: "1", src: SAMPLE_ID, ctz: "Asia/Seoul", label: "학교", color: null },
    { id: "2", src: "academy@group.calendar.google.com", ctz: "Asia/Seoul", label: "학원", color: "#D50000" },
  ];
  const day1 = buildTodayAgendaEmbedURL(calendars, { year: 2026, month: 11, day: 24 })!;
  const parsed = new URL(day1);
  expect(parsed.origin + parsed.pathname).toBe("https://calendar.google.com/calendar/embed");
  expect(parsed.searchParams.get("mode")).toBe("AGENDA");
  expect(parsed.searchParams.get("dates")).toBe("20261124/20261124");
  expect(parsed.searchParams.get("ctz")).toBe("Asia/Seoul");
  expect(parsed.searchParams.get("hl")).toBe("ko");
  expect(parsed.searchParams.getAll("src")).toEqual([SAMPLE_ID, "academy@group.calendar.google.com"]);
  expect(parsed.searchParams.getAll("color")).toEqual(["#D50000"]);

  const day2 = buildTodayAgendaEmbedURL(calendars, { year: 2026, month: 11, day: 25 })!;
  expect(new URL(day2).searchParams.get("dates")).toBe("20261125/20261125");
  expect(formatYMD({ year: 2026, month: 1, day: 5 })).toBe("20260105");
});

test("shortensLongCalendarSrc", () => {
  expect(shortCalendarSrc(SAMPLE_ID)).toBe("15ba96fff786…@group.calendar.google.com");
  expect(shortCalendarSrc("short@gmail.com")).toBe("short@gmail.com");
});
