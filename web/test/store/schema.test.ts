import { expect, test } from "vitest";
import { EMPTY_LOCKOUT } from "../../src/core/parentLock";
import { CURRENT_SCHEMA, emptyDoc, migrate } from "../../src/store/schema";

function validDoc() {
  return {
    schemaVersion: 1,
    data: {
      children: [
        {
          id: "c1",
          name: "첫째",
          avatar: "🐰",
          themeColor: "coral",
          order: 0,
          calendars: [
            {
              id: "cal1",
              url: "https://calendar.google.com/calendar/ical/kid%40group.calendar.google.com/private-secret/basic.ics",
              label: "학교",
              color: "#039BE5",
            },
          ],
        },
      ],
      tasks: [
        { id: "t1", childID: "c1", title: "세수하기", icon: "🧼", order: 0, createdAt: 1, archivedOn: null },
        { id: "t2", childID: "c1", title: "책 읽기", icon: "📖", order: 1, createdAt: 2, archivedOn: { year: 2026, month: 11, day: 18 } },
      ],
      schedules: [
        { id: "s1", taskID: "t1", slot: "morning", weekdays: [1, 2, 3, 4, 5], startOn: { year: 2026, month: 11, day: 1 }, endOn: null },
      ],
      times: [{ childID: "c1", weekday: 1, schoolTime: { hour: 8, minute: 20 }, bedTime: { hour: 21, minute: 30 } }],
      completions: [{ childID: "c1", taskID: "t1", day: { year: 2026, month: 11, day: 19 }, completedAt: 3 }],
    },
    settings: {
      pinHash: "ab",
      pinSalt: "cd",
      recoveryHash: null,
      recoverySalt: null,
      lockout: { failures: 2, lockedUntil: null },
      recoveryLockout: { failures: 0, lockedUntil: 99 },
      location: { name: "성남시", admin1: null, latitude: 37.42, longitude: 127.13 },
      didSeed: true,
      lastBackupAt: 5,
      dimPeriods: [
        { id: "d1", start: { hour: 9, minute: 0 }, end: { hour: 14, minute: 0 }, weekdays: [1, 2, 3, 4, 5] },
        { id: "d2", start: { hour: 23, minute: 30 }, end: { hour: 6, minute: 0 }, weekdays: [6, 7] },
      ],
      sound: { enabled: false, volume: "high" },
      calendarProxyUrl: "https://script.google.com/macros/s/abc/exec",
    },
    weather: { temperature: 1, weatherCode: 2, high: 3, low: 0, precipitationProbability: 10, fetchedAt: 4 },
    calendarCache: {
      c1: {
        dayKey: "2026-11-19",
        signature: "sig",
        fetchedAt: 10,
        events: [
          { id: "e1", title: "수영", allDay: false, startMin: 900, endMin: 960, calendarLabel: "학교", calendarColor: "#039BE5" },
        ],
      },
    },
  };
}

test("currentSchemaIsOne", () => {
  expect(CURRENT_SCHEMA).toBe(1);
  expect(emptyDoc().schemaVersion).toBe(1);
});

test("emptyDocShape", () => {
  const doc = emptyDoc();
  expect(doc.data).toEqual({ children: [], tasks: [], schedules: [], times: [], completions: [] });
  expect(doc.settings).toEqual({
    pinHash: null,
    pinSalt: null,
    recoveryHash: null,
    recoverySalt: null,
    lockout: EMPTY_LOCKOUT,
    recoveryLockout: EMPTY_LOCKOUT,
    location: null,
    didSeed: false,
    lastBackupAt: null,
    dimPeriods: [
      { id: "default-night", start: { hour: 22, minute: 0 }, end: { hour: 6, minute: 0 }, weekdays: [1, 2, 3, 4, 5, 6, 7] },
    ],
    sound: { enabled: true, volume: "medium" },
    calendarProxyUrl: null,
  });
  expect(doc.weather).toBeNull();
  expect(doc.calendarCache).toEqual({});
  expect(emptyDoc().settings.dimPeriods).not.toBe(doc.settings.dimPeriods);
  expect(emptyDoc()).not.toBe(doc);
  expect(emptyDoc().data.children).not.toBe(doc.data.children);
});

test("migrateAcceptsValidDoc", () => {
  const result = migrate(validDoc());
  expect(result).toEqual({ ok: true, doc: validDoc() });
});

test("migrateAcceptsEmptyDoc", () => {
  expect(migrate(JSON.parse(JSON.stringify(emptyDoc())))).toEqual({ ok: true, doc: emptyDoc() });
});

test("migrateFillsMissingSettingsWithDefaults", () => {
  const raw = validDoc() as Record<string, unknown>;
  raw.settings = { location: null };
  delete raw.weather;
  const result = migrate(raw);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.doc.settings).toEqual(emptyDoc().settings);
  expect(result.doc.weather).toBeNull();
});

test("migrateFillsMissingDimPeriodsWithDefault", () => {
  const raw = validDoc() as { settings: Record<string, unknown> };
  delete raw.settings.dimPeriods;
  const result = migrate(raw);
  expect(result.ok && result.doc.settings.dimPeriods).toEqual(emptyDoc().settings.dimPeriods);
  expect(result.ok && result.doc.schemaVersion).toBe(1);
});

test("migrateKeepsEmptyDimPeriods", () => {
  const raw = validDoc() as { settings: Record<string, unknown> };
  raw.settings.dimPeriods = [];
  const result = migrate(raw);
  expect(result.ok && result.doc.settings.dimPeriods).toEqual([]);
});

test("migrateDropsBadWeatherCache", () => {
  const raw = validDoc() as Record<string, unknown>;
  raw.weather = { temperature: "warm" };
  const result = migrate(raw);
  expect(result.ok && result.doc.weather).toBeNull();
});

test("migrateDropsUnknownFields", () => {
  const raw = validDoc() as Record<string, unknown>;
  raw.extra = 1;
  const result = migrate(raw);
  expect(result.ok && "extra" in result.doc).toBe(false);
});

test("migrateRejectsFutureSchema", () => {
  expect(migrate({ ...validDoc(), schemaVersion: 2 })).toEqual({ ok: false, reason: "future" });
  expect(migrate({ ...validDoc(), schemaVersion: 99 })).toEqual({ ok: false, reason: "future" });
});

test("migrateRejectsCorruptInput", () => {
  const bad: unknown[] = [null, undefined, "garbage", 42, [], {}, { schemaVersion: 0 }, { schemaVersion: "1" }, { schemaVersion: 1 }];
  for (const raw of bad) expect(migrate(raw)).toEqual({ ok: false, reason: "corrupt" });
});

test("migrateRejectsBadStructure", () => {
  const mutations: Array<(d: ReturnType<typeof validDoc>) => void> = [
    (d) => ((d as { data: unknown }).data = null),
    (d) => ((d.data as { tasks: unknown }).tasks = {}),
    (d) => delete (d.data as Partial<typeof d.data>).completions,
    (d) => ((d.data.children[0] as { name: unknown }).name = 3),
    (d) => ((d.data.children[0] as { order: unknown }).order = "0"),
    (d) => ((d.data.tasks[0] as { archivedOn: unknown }).archivedOn = "2026-11-18"),
    (d) => ((d.data.schedules[0] as { slot: unknown }).slot = "noon"),
    (d) => ((d.data.schedules[0] as { weekdays: unknown }).weekdays = [0]),
    (d) => ((d.data.schedules[0] as { startOn: unknown }).startOn = { year: 2026 }),
    (d) => ((d.data.times[0] as { weekday: unknown }).weekday = 8),
    (d) => ((d.data.times[0] as { bedTime: unknown }).bedTime = null),
    (d) => ((d.data.completions[0] as { day: unknown }).day = null),
    (d) => ((d as { settings: unknown }).settings = "x"),
    (d) => delete (d as Partial<typeof d>).settings,
    (d) => ((d.settings as { pinHash: unknown }).pinHash = 1),
    (d) => ((d.settings as { didSeed: unknown }).didSeed = "yes"),
    (d) => ((d.settings as { lockout: unknown }).lockout = { failures: "1" }),
    (d) => ((d.settings as { location: unknown }).location = { name: "x" }),
    (d) => ((d.settings as { lastBackupAt: unknown }).lastBackupAt = "now"),
    (d) => ((d.settings as { dimPeriods: unknown }).dimPeriods = {}),
    (d) => ((d.settings.dimPeriods[0] as { id: unknown }).id = 1),
    (d) => ((d.settings.dimPeriods[0] as { start: unknown }).start = { hour: 24, minute: 0 }),
    (d) => ((d.settings.dimPeriods[0] as { end: unknown }).end = null),
    (d) => ((d.settings.dimPeriods[0] as { weekdays: unknown }).weekdays = [8]),
    (d) => ((d.data.children[0] as { calendars: unknown }).calendars = {}),
    (d) => ((d.data.children[0]!.calendars[0] as { url: unknown }).url = ""),
    (d) => ((d.data.children[0]!.calendars[0] as { id: unknown }).id = 123),
  ];
  mutations.forEach((mutate, i) => {
    const doc = validDoc();
    mutate(doc);
    expect([i, migrate(doc)]).toEqual([i, { ok: false, reason: "corrupt" }]);
  });
});

test("migrateFillsMissingSoundWithDefault", () => {
  const raw = validDoc() as { settings: Record<string, unknown> };
  delete raw.settings.sound;
  const result = migrate(raw);
  expect(result.ok && result.doc.settings.sound).toEqual({ enabled: true, volume: "medium" });
  expect(result.ok && result.doc.schemaVersion).toBe(1);
  expect(emptyDoc().settings.sound).not.toBe(emptyDoc().settings.sound);
});

test("migrateKeepsValidSound", () => {
  for (const volume of ["low", "medium", "high"]) {
    const raw = validDoc() as { settings: Record<string, unknown> };
    raw.settings.sound = { enabled: true, volume };
    const result = migrate(raw);
    expect(result.ok && result.doc.settings.sound).toEqual({ enabled: true, volume });
  }
});

test("migrateMalformedSoundFallsBackToDefaultWithoutCorrupt", () => {
  const bad: unknown[] = [
    null,
    "on",
    [],
    {},
    { enabled: "yes", volume: "low" },
    { enabled: true, volume: "loud" },
    { enabled: true },
    { volume: "low" },
  ];
  for (const sound of bad) {
    const raw = validDoc() as { settings: Record<string, unknown> };
    raw.settings.sound = sound;
    const result = migrate(raw);
    expect([sound, result.ok]).toEqual([sound, true]);
    expect(result.ok && result.doc.settings.sound).toEqual({ enabled: true, volume: "medium" });
    // 다른 설정은 그대로 읽습니다.
    expect(result.ok && result.doc.settings.dimPeriods).toEqual(validDoc().settings.dimPeriods);
  }
});

test("migrateFillsMissingCalendarsWithEmptyArray", () => {
  const raw = validDoc();
  delete (raw.data.children[0] as { calendars?: unknown }).calendars;
  const result = migrate(raw);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.doc.data.children[0]!.calendars).toEqual([]);
});

test("migrateKeepsMultipleCalendarsAndMigratesLegacySrc", () => {
  const raw = validDoc();
  (raw.data.children[0] as { calendars: unknown }).calendars = [
    { id: "a", src: "one@group.calendar.google.com" },
    { id: "b", url: "https://calendar.google.com/calendar/ical/two%40group.calendar.google.com/private-xyz/basic.ics", label: "학원", color: "#d50000" },
  ];
  const result = migrate(raw);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.doc.data.children[0]!.calendars).toEqual([
    { id: "a", url: "https://calendar.google.com/calendar/ical/one%40group.calendar.google.com/public/basic.ics", label: "", color: null },
    { id: "b", url: "https://calendar.google.com/calendar/ical/two%40group.calendar.google.com/private-xyz/basic.ics", label: "학원", color: "#D50000" },
  ]);
});

test("migrateDropsMalformedCalendarCacheWithoutCorrupt", () => {
  const raw = validDoc() as Record<string, unknown>;
  raw.calendarCache = { bad: { dayKey: 123 } };
  const result = migrate(raw);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.doc.calendarCache).toEqual({});
});
