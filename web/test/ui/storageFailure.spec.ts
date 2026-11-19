import { expect, test } from "@playwright/test";
import { injectStorageFaults, open, panel, setFailSaves } from "./support";

const THU_MORNING = "2026-11-19T07:42:00+09:00";

test("transient load failure offers retry instead of the corrupt-data screen", async ({ page }) => {
  await injectStorageFaults(page, 1);
  await page.goto(`./?fixedNow=${encodeURIComponent(THU_MORNING)}`);
  await expect(page.locator(".full-message-title")).toHaveText("데이터를 불러오지 못했어요");
  await expect(page.locator(".full-message-body")).toHaveText(
    "잠시 후 다시 해 주세요. 계속 안 되면 앱을 완전히 닫았다가 다시 여십시오.",
  );
  await expect(page.getByText("데이터를 열 수 없어요")).toHaveCount(0);
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.locator(".panel")).toHaveCount(2);
});

test("corrupt document still shows the read-only screen", async ({ page }) => {
  await open(page, THU_MORNING);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("kid-board", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const put = db.transaction("doc", "readwrite").objectStore("doc").put("garbage", "main");
          put.onsuccess = () => {
            db.close();
            resolve();
          };
          put.onerror = () => reject(put.error);
        };
      }),
  );
  await page.reload();
  await expect(page.locator(".full-message-title")).toHaveText("데이터를 열 수 없어요");
  await expect(page.getByRole("button", { name: "다시 시도" })).toHaveCount(0);
});

test("a completion that fails to save reverts and shows the toast", async ({ page }) => {
  await injectStorageFaults(page, 0);
  await open(page, THU_MORNING);
  await setFailSaves(page, true);
  const card = panel(page, 0).locator(".task-card").nth(0);
  await card.click();
  await expect(page.locator(".toast")).toHaveText("저장하지 못했어요. 다시 눌러 주세요.");
  await expect(card).not.toHaveClass(/done/);
  await expect(panel(page, 0).locator(".stamp")).toHaveCount(0);
  // 다시 누르면 "취소할까요?"가 아니라 완료됩니다.
  await setFailSaves(page, false);
  await card.click();
  await expect(panel(page, 0).locator(".dialog-title")).toHaveCount(0);
  await expect(card).toHaveClass(/done/);
});
