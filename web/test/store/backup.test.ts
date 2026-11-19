import { expect, test } from "vitest";
import { BACKUP_ERROR_MESSAGE, exportBackup, parseBackup } from "../../src/store/backup";
import { BoardStore } from "../../src/store/boardStore";
import { emptyDoc } from "../../src/store/schema";
import { at } from "../support";
import { MemoryStorage, counterID } from "./helpers";

const seongnam = { name: "성남시", admin1: "경기도", latitude: 37.42, longitude: 127.13 };

async function storeWithPin() {
  const store = await BoardStore.open(new MemoryStorage(), () => at(2026, 11, 19, 7), counterID());
  await store.seedIfNeeded();
  await store.setPin("1234");
  await store.verifyPin("0000");
  await store.setLocation(seongnam);
  return store;
}

test("exportFileNameUsesLocalDate", async () => {
  const { fileName } = exportBackup(emptyDoc(), at(2026, 1, 5, 23, 59));
  expect(fileName).toBe("kid-board-backup-20260105.json");
});

test("exportExcludesSecrets", async () => {
  const store = await storeWithPin();
  const { json } = exportBackup(store.doc(), at(2026, 11, 19, 7));
  for (const name of ["pinHash", "pinSalt", "recoveryHash", "recoverySalt", "lockout", "recoveryLockout", "Lockout"]) {
    expect(json).not.toContain(name);
  }
  const parsed = JSON.parse(json);
  expect(parsed.schemaVersion).toBe(1);
  expect(parsed.data.children.length).toBe(2);
  expect(parsed.settings.location).toEqual(seongnam);
  expect(parsed.settings.dimPeriods).toEqual(store.settings().dimPeriods);
});

test("exportThenParseRoundTrips", async () => {
  const store = await storeWithPin();
  const { json } = exportBackup(store.doc(), at(2026, 11, 19, 7));
  const result = parseBackup(json);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.doc.data).toEqual(store.snapshot());
  expect(result.doc.settings.location).toEqual(seongnam);
  expect(result.doc.settings.pinHash).toBeNull();
  expect(result.doc.settings.dimPeriods).toEqual(store.settings().dimPeriods);
});

test("parseBackupRejectsBadInput", () => {
  const future = JSON.stringify({ ...emptyDoc(), schemaVersion: 99 });
  const missing = JSON.stringify({ schemaVersion: 1, data: { children: [] }, settings: {} });
  for (const text of ["not json", "{}", "", "null", "[]", future, missing]) {
    expect(parseBackup(text)).toEqual({ ok: false, message: "백업 파일을 읽을 수 없어요" });
  }
  expect(BACKUP_ERROR_MESSAGE).toBe("백업 파일을 읽을 수 없어요");
});

test("restoreKeepsCurrentPin", async () => {
  const source = await BoardStore.open(new MemoryStorage(), () => at(2026, 11, 19, 7), counterID("src"));
  await source.addChild("하나", "🐱", "mint");
  await source.setPin("9999");
  await source.setLocation({ name: "부산", admin1: null, latitude: 35.1, longitude: 129.0 });
  const parsed = parseBackup(exportBackup(source.doc(), at(2026, 11, 19, 7)).json);
  if (!parsed.ok) throw new Error("parse failed");

  const storage = new MemoryStorage();
  const target = await BoardStore.open(storage, () => at(2026, 11, 19, 7), counterID());
  const code = await target.setPin("1234");
  await target.markBackedUp();
  const lastBackupAt = target.settings().lastBackupAt;
  let count = 0;
  target.subscribe(() => {
    count += 1;
  });
  const saves = storage.saves;
  await target.restore(parsed.doc);
  expect(count).toBe(1);
  expect(storage.saves).toBe(saves + 1);
  expect(target.snapshot().children.map((c) => c.name)).toEqual(["하나"]);
  expect(target.settings().location?.name).toBe("부산");
  expect(target.settings().didSeed).toBe(true);
  expect(target.settings().lastBackupAt).toBe(lastBackupAt);
  expect(await target.verifyPin("1234")).toBe("ok");
  expect(await target.verifyPin("9999")).toBe("wrong");
  expect(await target.verifyRecoveryCode(code)).toBe("ok");
});

const SCHOOL = [{ id: "d1", start: { hour: 9, minute: 0 }, end: { hour: 14, minute: 0 }, weekdays: [1, 2, 3, 4, 5] as (1 | 2 | 3 | 4 | 5)[] }];

test("restoreTakesDimPeriodsFromBackup", async () => {
  const source = await BoardStore.open(new MemoryStorage(), () => at(2026, 11, 19, 7), counterID("src"));
  await source.setDimPeriods(SCHOOL);
  const parsed = parseBackup(exportBackup(source.doc(), at(2026, 11, 19, 7)).json);
  if (!parsed.ok) throw new Error("parse failed");
  const target = await BoardStore.open(new MemoryStorage(), () => at(2026, 11, 19, 7), counterID());
  await target.setDimPeriods([]);
  await target.restore(parsed.doc);
  expect(target.settings().dimPeriods).toEqual(SCHOOL);
});

test("restoreWithoutDimPeriodsUsesDefault", async () => {
  const old = JSON.parse(exportBackup(emptyDoc(), at(2026, 11, 19, 7)).json);
  delete old.settings.dimPeriods;
  const parsed = parseBackup(JSON.stringify(old));
  if (!parsed.ok) throw new Error("parse failed");
  const target = await BoardStore.open(new MemoryStorage(), () => at(2026, 11, 19, 7), counterID());
  await target.setDimPeriods(SCHOOL);
  await target.restore(parsed.doc);
  expect(target.settings().dimPeriods).toEqual(emptyDoc().settings.dimPeriods);
});
