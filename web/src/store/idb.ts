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

/** `indexedDB.open`이 이만큼 끝나지 않으면 실패로 봅니다. Safari에서 open이 멈추는 경우가 있습니다. */
export const OPEN_TIMEOUT_MS = 10_000;

/** 열기가 실패했거나 시간 안에 끝나지 않았습니다. 데이터가 손상되었다는 뜻은 아닙니다. */
export class StorageOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageOpenError";
  }
}

function openDB(dbName: string, timeoutMs: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new StorageOpenError("IndexedDB open timed out"))), timeoutMs);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(dbName, 1);
    } catch (err) {
      finish(() => reject(err));
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => {
      // 시간이 지난 뒤에 열린 연결은 쓰지 않으므로 닫습니다.
      if (done) req.result.close();
      finish(() => resolve(req.result));
    };
    req.onerror = () => finish(() => reject(req.error ?? new StorageOpenError("IndexedDB open failed")));
    req.onblocked = () => finish(() => reject(new StorageOpenError("IndexedDB open blocked")));
  });
}

/**
 * 전체 문서를 object store "doc"의 키 "main" 하나에 저장합니다.
 * 연결은 한 번 열어 계속 씁니다. 연결이 닫히거나(`close`, `versionchange`) 트랜잭션이 실패하면 연결을 버리고,
 * 실패한 읽기나 저장을 새 연결에서 한 번 더 합니다. Safari는 앱이 뒤로 갔다 오면 연결을 잃을 수 있습니다.
 */
export function idbStorage(dbName = "kid-board", openTimeoutMs = OPEN_TIMEOUT_MS): DocStorage {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const forget = (p: Promise<IDBDatabase>) => {
    if (dbPromise === p) dbPromise = null;
  };
  const db = () => {
    if (!dbPromise) {
      const p = openDB(dbName, openTimeoutMs).then((conn) => {
        conn.onclose = () => forget(p);
        conn.onversionchange = () => {
          conn.close();
          forget(p);
        };
        return conn;
      });
      dbPromise = p;
      // 열기가 실패하면 다음 호출에서 다시 엽니다.
      p.catch(() => forget(p));
    }
    return dbPromise;
  };
  /** 연결을 얻은 뒤의 실패는 새 연결에서 한 번 더 합니다. 열기 자체의 실패는 그대로 던집니다. */
  const run = async <T>(op: (conn: IDBDatabase) => Promise<T>): Promise<T> => {
    const p = db();
    const conn = await p;
    try {
      return await op(conn);
    } catch {
      forget(p);
      try {
        conn.close();
      } catch {
        // 이미 닫혔습니다.
      }
      return op(await db());
    }
  };
  return {
    load() {
      return run(async (conn) => {
        const tx = conn.transaction(STORE_NAME, "readonly");
        const value = await request(tx.objectStore(STORE_NAME).get(DOC_KEY));
        return value === undefined ? null : (value as unknown);
      });
    },
    save(doc) {
      return run(async (conn) => {
        const tx = conn.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(doc, DOC_KEY);
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
        });
      });
    },
  };
}
