import { expect, test } from "vitest";
import { shareBackup } from "../../src/ui/parent/shareBackup";

const FILE = { fileName: "kid-board-backup-20261119.json", json: '{"schemaVersion":1}' };

interface FakeAnchor {
  href: string;
  download: string;
  clicks: number;
  removed: boolean;
  click(): void;
  remove(): void;
}

/** `createElement("a")`와 `body.appendChild`만 흉내 낸 문서입니다. */
function fakeDoc() {
  const anchors: FakeAnchor[] = [];
  const appended: unknown[] = [];
  const doc = {
    createElement(tag: string) {
      expect(tag).toBe("a");
      const a: FakeAnchor = {
        href: "",
        download: "",
        clicks: 0,
        removed: false,
        click() {
          this.clicks++;
        },
        remove() {
          this.removed = true;
        },
      };
      anchors.push(a);
      return a;
    },
    body: {
      appendChild(node: unknown) {
        appended.push(node);
        return node;
      },
    },
  };
  return { doc: doc as unknown as Document, anchors, appended };
}

test("sharesWhenFilesSupported", async () => {
  const shared: ShareData[] = [];
  const nav = {
    canShare: (data: ShareData) => Array.isArray(data.files) && data.files.length === 1,
    share: async (data: ShareData) => {
      shared.push(data);
    },
  } as unknown as Navigator;
  const { doc, anchors } = fakeDoc();
  const result = await shareBackup(FILE, nav, doc);
  expect(result).toBe("shared");
  expect(shared).toHaveLength(1);
  const file = shared[0]?.files?.[0];
  expect(file?.name).toBe("kid-board-backup-20261119.json");
  expect(file?.type).toBe("application/json");
  expect(await file?.text()).toBe(FILE.json);
  expect(anchors).toHaveLength(0);
});

test("downloadsWhenShareUnsupported", async () => {
  const nav = {} as Navigator;
  const { doc, anchors, appended } = fakeDoc();
  const result = await shareBackup(FILE, nav, doc);
  expect(result).toBe("downloaded");
  expect(anchors).toHaveLength(1);
  const a = anchors[0]!;
  expect(a.download).toBe("kid-board-backup-20261119.json");
  expect(a.href).not.toBe("");
  expect(a.clicks).toBe(1);
  expect(appended).toContain(a);
  expect(a.removed).toBe(true);
});

test("downloadsWhenCanShareRefusesFiles", async () => {
  let shares = 0;
  const nav = {
    canShare: () => false,
    share: async () => {
      shares++;
    },
  } as unknown as Navigator;
  const { doc, anchors } = fakeDoc();
  expect(await shareBackup(FILE, nav, doc)).toBe("downloaded");
  expect(shares).toBe(0);
  expect(anchors[0]?.clicks).toBe(1);
});

test("cancelledShareDoesNotMarkBackup", async () => {
  const nav = {
    canShare: () => true,
    share: () => Promise.reject(Object.assign(new Error("cancelled"), { name: "AbortError" })),
  } as unknown as Navigator;
  const { doc, anchors } = fakeDoc();
  const result = await shareBackup(FILE, nav, doc);
  expect(result).toBe("cancelled");
  // 취소하면 내려받기로 바꾸지 않습니다. 호출한 쪽은 "cancelled"일 때 markBackedUp을 부르지 않습니다.
  expect(anchors).toHaveLength(0);
});

test("otherShareErrorsReject", async () => {
  const nav = {
    canShare: () => true,
    share: () => Promise.reject(Object.assign(new Error("no gesture"), { name: "NotAllowedError" })),
  } as unknown as Navigator;
  const { doc } = fakeDoc();
  await expect(shareBackup(FILE, nav, doc)).rejects.toThrow("no gesture");
});
