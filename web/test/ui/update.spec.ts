import { expect, test } from "@playwright/test";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 운영 빌드(vite preview)에서 실행합니다. dist/sw.js를 잠시 바꿔 새 배포를 흉내 냅니다.
const SW = fileURLToPath(new URL("../../dist/sw.js", import.meta.url));

test("waiting worker applies only after 5 quiet minutes at night and reloads once", async ({ page }) => {
  const original = readFileSync(SW, "utf8");
  try {
    await page.clock.install({ time: new Date("2026-11-19T23:00:00+09:00") });
    let loads = 0;
    page.on("load", () => loads++);
    await page.goto("./");
    await expect(page.locator(".night-overlay")).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const firstLoads = loads;

    appendFileSync(SW, "\n// new deploy\n");
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);

    // 입력 없이 4분: 아직 적용하지 않습니다.
    await page.clock.runFor(4 * 60_000);
    await page.waitForTimeout(500);
    expect(loads).toBe(firstLoads);

    // 5분이 지나면 SKIP_WAITING을 보내고, 새 워커가 맡으면 한 번만 다시 엽니다.
    await page.clock.runFor(2 * 60_000);
    await expect.poll(() => loads, { timeout: 10_000 }).toBe(firstLoads + 1);
    await page.waitForTimeout(1500);
    expect(loads).toBe(firstLoads + 1);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          return { waiting: !!reg?.waiting, active: reg?.active?.state };
        }),
      )
      .toEqual({ waiting: false, active: "activated" });
  } finally {
    writeFileSync(SW, original);
  }
});
