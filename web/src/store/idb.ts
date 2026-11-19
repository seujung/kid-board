import type { AppDoc } from "./schema";

/** 앱 문서 하나를 읽고 쓰는 저장소입니다. */
export interface DocStorage {
  load(): Promise<unknown | null>;
  save(doc: AppDoc): Promise<void>;
}

const STORE_NAME = "doc";
const DOC_KEY = "main";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDB(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

/** 전체 문서를 object store "doc"의 키 "main" 하나에 저장합니다. */
export function idbStorage(dbName = "kid-board"): DocStorage {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => {
    if (!dbPromise) {
      dbPromise = openDB(dbName);
      // 실패하면 다음 호출에서 다시 엽니다.
      dbPromise.catch(() => {
        dbPromise = null;
      });
    }
    return dbPromise;
  };
  return {
    async load() {
      const tx = (await db()).transaction(STORE_NAME, "readonly");
      const value = await request(tx.objectStore(STORE_NAME).get(DOC_KEY));
      return value === undefined ? null : (value as unknown);
    },
    async save(doc) {
      const tx = (await db()).transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(doc, DOC_KEY);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      });
    },
  };
}
