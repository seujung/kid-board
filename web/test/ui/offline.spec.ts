import { expect, test } from "@playwright/test";

// 운영 빌드(vite preview)에서 실행합니다. 서비스 워커가 빌드 결과를 캐시해서 오프라인에서도 보드를 엽니다.
test("board opens offline after first visit", async ({ page, context }) => {
  await page.goto("./");
  await expect(page.locator(".panel")).toHaveCount(2);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/kid-board\/$/);
  // 처음 설치한 워커가 페이지를 맡을 때까지 기다립니다(clients.claim).
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls: string[] = [];
    for (const key of keys) for (const req of await (await caches.open(key)).keys()) urls.push(new URL(req.url).pathname);
    return { keys, urls };
  });
  expect(cached.keys).toHaveLength(1);
  expect(cached.urls).toContain("/kid-board/");
  expect(cached.urls).toContain("/kid-board/manifest.webmanifest");
  expect(cached.urls.some((u) => /^\/kid-board\/assets\/index-.+\.js$/.test(u))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".panel")).toHaveCount(2);
  // 네트워크가 정말 끊겼는지 확인합니다. 캐시에 없는 주소는 실패해야 합니다.
  const uncached = await page.evaluate(() => fetch("/kid-board/not-cached.txt").then(() => "ok", () => "failed"));
  expect(uncached).toBe("failed");
  await expect(page.locator(".task-card").first()).toBeVisible();
  // 검색어가 붙은 주소도 캐시한 페이지로 엽니다.
  await page.goto("./?from=homescreen");
  await expect(page.locator(".panel")).toHaveCount(2);
  await context.setOffline(false);
});
