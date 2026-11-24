import { expect, test } from "vitest";
import { parseIcsEventsForDay } from "../../src/core/ical";

const META = { label: "학교", color: "#3B82C4" };
const DAY = { year: 2026, month: 11, day: 24 }; // 화요일

function wrapCal(body: string): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//Test//EN", body, "END:VCALENDAR"].join("\r\n");
}

test("parsesTimedAndAllDayEventsWithUnfoldingAndEscapes", () => {
  const ics = wrapCal(
    [
      "BEGIN:VEVENT",
      "UID:ev-1",
      "DTSTART;VALUE=DATE:20261124",
      "DTEND;VALUE=DATE:20261125",
      "SUMMARY:현장체험학습\\, 도시락",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:ev-2",
      "DTSTART;TZID=Asia/Seoul:20261124T143000",
      "DTEND;TZID=Asia/Seoul:20261124T160000",
      "SUMMARY:피아노\\; 레슨",
      " 계속",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "SUMMARY:알람 제목 무시",
      "END:VALARM",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:ev-other-day",
      "DTSTART;TZID=Asia/Seoul:20261125T090000",
      "DTEND;TZID=Asia/Seoul:20261125T100000",
      "SUMMARY:내일 일정",
      "END:VEVENT",
    ].join("\r\n"),
  );

  expect(parseIcsEventsForDay(ics, DAY, META)).toEqual([
    {
      id: `ev-1#${new Date(2026, 10, 24, 0, 0, 0, 0).getTime()}`,
      title: "현장체험학습, 도시락",
      allDay: true,
      startMin: null,
      endMin: null,
      calendarLabel: "학교",
      calendarColor: "#3B82C4",
    },
    {
      id: `ev-2#${new Date(2026, 10, 24, 14, 30, 0, 0).getTime()}`,
      title: "피아노; 레슨계속",
      allDay: false,
      startMin: 14 * 60 + 30,
      endMin: 16 * 60,
      calendarLabel: "학교",
      calendarColor: "#3B82C4",
    },
  ]);
});

test("convertsUtcAndExternalTimezonesToSeoulAndSupportsDuration", () => {
  const ics = wrapCal(
    [
      "BEGIN:VEVENT",
      "UID:utc-ev",
      // 2026-11-24 01:00 UTC == 10:00 KST
      "DTSTART:20261124T010000Z",
      "DURATION:PT45M",
      "SUMMARY:화상 영어",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:ny-ev",
      // 2026-11-23 20:00 America/New_York (EST UTC-5) == 2026-11-24 10:00 KST? Wait: 20:00 EST -> +14h = 2026-11-24 10:00 KST!
      "DTSTART;TZID=America/New_York:20261123T200000",
      "DTEND;TZID=America/New_York:20261123T210000",
      "SUMMARY:뉴욕 타임존",
      "END:VEVENT",
    ].join("\r\n"),
  );

  const events = parseIcsEventsForDay(ics, DAY, META);
  expect(events.map((e) => [e.title, e.startMin, e.endMin])).toEqual([
    ["화상 영어", 600, 645],
    ["뉴욕 타임존", 600, 660],
  ]);
});

test("clampsMultiDayTimedEventToTargetDay", () => {
  const ics = wrapCal(
    [
      "BEGIN:VEVENT",
      "UID:span",
      "DTSTART;TZID=Asia/Seoul:20261123T220000",
      "DTEND;TZID=Asia/Seoul:20261124T083000",
      "SUMMARY:밤샘 캠프",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:multi-allday",
      "DTSTART;VALUE=DATE:20261123",
      "DTEND;VALUE=DATE:20261126",
      "SUMMARY:방학",
      "END:VEVENT",
    ].join("\r\n"),
  );
  const events = parseIcsEventsForDay(ics, DAY, META);
  expect(events).toHaveLength(2);
  expect(events[0]).toMatchObject({ title: "밤샘 캠프", allDay: false, startMin: 0, endMin: 510 });
  expect(events[1]).toMatchObject({ title: "방학", allDay: true, startMin: null, endMin: null });
});

test("expandsDailyWeeklyMonthlyYearlyRulesWithExdateAndRecurrenceOverrides", () => {
  const ics = wrapCal(
    [
      // 매일 반복 + 11월 24일 EXDATE 제외
      "BEGIN:VEVENT",
      "UID:daily-ex",
      "DTSTART;TZID=Asia/Seoul:20261120T080000",
      "DTEND;TZID=Asia/Seoul:20261120T082000",
      "RRULE:FREQ=DAILY",
      "EXDATE;TZID=Asia/Seoul:20261124T080000",
      "SUMMARY:제외된 매일 일정",
      "END:VEVENT",
      // 매주 화·목 반복 + 11월 24일 시간 수정(RECURRENCE-ID)
      "BEGIN:VEVENT",
      "UID:weekly-mod",
      "DTSTART;TZID=Asia/Seoul:20261110T150000",
      "DTEND;TZID=Asia/Seoul:20261110T160000",
      "RRULE:FREQ=WEEKLY;BYDAY=TU,TH",
      "SUMMARY:수영",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:weekly-mod",
      "RECURRENCE-ID;TZID=Asia/Seoul:20261124T150000",
      "DTSTART;TZID=Asia/Seoul:20261124T170000",
      "DTEND;TZID=Asia/Seoul:20261124T180000",
      "SUMMARY:수영(시간변경)",
      "END:VEVENT",
      // 매월 넷째 화요일 (2026-11-24)
      "BEGIN:VEVENT",
      "UID:monthly-ord",
      "DTSTART;TZID=Asia/Seoul:20260922T110000",
      "DTEND;TZID=Asia/Seoul:20260922T120000",
      "RRULE:FREQ=MONTHLY;BYDAY=4TU",
      "SUMMARY:도서관 날",
      "END:VEVENT",
      // 매년 11월 24일
      "BEGIN:VEVENT",
      "UID:yearly-ev",
      "DTSTART;VALUE=DATE:20241124",
      "RRULE:FREQ=YEARLY",
      "SUMMARY:기념일",
      "END:VEVENT",
      // 취소된 인스턴스
      "BEGIN:VEVENT",
      "UID:cancelled-weekly",
      "DTSTART;TZID=Asia/Seoul:20261117T130000",
      "DTEND;TZID=Asia/Seoul:20261117T140000",
      "RRULE:FREQ=WEEKLY",
      "SUMMARY:미술",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:cancelled-weekly",
      "RECURRENCE-ID;TZID=Asia/Seoul:20261124T130000",
      "STATUS:CANCELLED",
      "SUMMARY:미술",
      "END:VEVENT",
    ].join("\r\n"),
  );

  const events = parseIcsEventsForDay(ics, DAY, META);
  expect(events.map((e) => [e.title, e.allDay, e.startMin, e.endMin])).toEqual([
    ["수영(시간변경)", false, 17 * 60, 18 * 60],
    ["도서관 날", false, 11 * 60, 12 * 60],
    ["기념일", true, null, null],
  ]);
});
