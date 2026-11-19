import "fake-indexeddb/auto";
import { afterEach, expect, test, vi } from "vitest";
import { idbStorage } from "../../src/store/idb";
import { emptyDoc } from "../../src/store/schema";

let dbCounter = 0;
function freshDBName() {
  dbCounter += 1;
  return `kid-board-idb-test-${dbCounter}`;
}

function docWith(location: string) {
  const doc = emptyDoc();
  doc.settings.location = { name: location, admin1: null, latitude: 37, longitude: 127 };
  return doc;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("idbReopensAfterConnectionIsClosed", async () => {
  const storage = idbStorage(freshDBName());
  let connection: IDBDatabase | null = null;
  const original = IDBDatabase.prototype.transaction;
  vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (this: IDBDatabase, ...args) {
    connection = this;
    return original.apply(this, args as Parameters<typeof original>);
  });
  await storage.save(docWith("하나"));
  // Safari가 연결을 잃은 상황을 흉내 냅니다. 닫힌 연결의 transaction()은 InvalidStateError를 던집니다.
  connection!.close();
  await storage.save(docWith("둘"));
  expect(await storage.load()).toEqual(docWith("둘"));
});

test("idbReleasesConnectionOnVersionChange", async () => {
  const name = freshDBName();
  const storage = idbStorage(name);
  await storage.save(docWith("하나"));
  // 다른 연결이 데이터베이스를 지우려 하면 연결을 닫아 막지 않습니다.
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
  expect(await storage.load()).toBeNull();
  await storage.save(docWith("둘"));
  expect(await storage.load()).toEqual(docWith("둘"));
});

test("idbRetriesFailedSaveOnceOnFreshConnection", async () => {
  const storage = idbStorage(freshDBName());
  await storage.save(docWith("하나"));
  const opens = vi.spyOn(indexedDB, "open");
  const original = IDBDatabase.prototype.transaction;
  let failures = 1;
  vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (this: IDBDatabase, ...args) {
    if (failures > 0) {
      failures -= 1;
      throw new DOMException("Connection to Indexed Database server lost", "UnknownError");
    }
    return original.apply(this, args as Parameters<typeof original>);
  });
  await storage.save(docWith("둘"));
  expect(opens).toHaveBeenCalledTimes(1);
  expect(await storage.load()).toEqual(docWith("둘"));
});

test("idbOpenTimesOut", async () => {
  vi.useFakeTimers();
  // 끝나지 않는 open 요청입니다.
  vi.spyOn(indexedDB, "open").mockImplementation(() => ({}) as IDBOpenDBRequest);
  const storage = idbStorage(freshDBName());
  const loading = storage.load();
  const settled = vi.fn();
  loading.then(settled, settled);
  await vi.advanceTimersByTimeAsync(9_000);
  expect(settled).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1_000);
  await expect(loading).rejects.toThrow("timed out");
});
