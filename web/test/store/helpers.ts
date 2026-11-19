import type { AppDoc } from "../../src/store/schema";
import type { DocStorage } from "../../src/store/idb";

/** 저장 호출 횟수를 세는 메모리 저장소입니다. */
export class MemoryStorage implements DocStorage {
  saves = 0;
  stored: unknown | null;
  constructor(initial: unknown | null = null) {
    this.stored = initial;
  }
  async load(): Promise<unknown | null> {
    return this.stored === null ? null : JSON.parse(JSON.stringify(this.stored));
  }
  async save(doc: AppDoc): Promise<void> {
    this.saves += 1;
    this.stored = JSON.parse(JSON.stringify(doc));
  }
}

/** 테스트에서 바꿀 수 있는 시계입니다. */
export function clock(start: Date) {
  let current = start;
  return {
    now: () => current,
    set(d: Date) {
      current = d;
    },
  };
}

export function counterID(prefix = "id"): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}${String(n).padStart(4, "0")}`;
  };
}
