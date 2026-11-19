import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Playwright 화면 확인이 함께 쓰는 도움 함수입니다(파일 이름이 .spec.ts가 아니라서 테스트로 실행하지 않습니다). */

export const SHOTS = "test-results/screens";
export const W = 1024;
export const H = 768;

export async function open(page: Page, iso: string): Promise<void> {
  await page.goto(`./?fixedNow=${encodeURIComponent(iso)}`);
  await expect(page.locator(".panel")).toHaveCount(2);
}

export async function expectInViewport(page: Page, selector: string): Promise<void> {
  const items = page.locator(selector);
  const n = await items.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const box = await items.nth(i).boundingBox();
    expect(box).not.toBeNull();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(W);
    expect(box.y + box.height).toBeLessThanOrEqual(H);
  }
}

export const FORECAST = {
  current: { temperature_2m: 3.4, weather_code: 61 },
  daily: { temperature_2m_max: [9], temperature_2m_min: [-1], precipitation_probability_max: [70] },
};

/** 앱이 넣은 예시 데이터에 날씨 지역(서울)을 더하고, Open-Meteo 응답을 흉내 낸 뒤 다시 엽니다. */
export async function withSeoulWeather(page: Page): Promise<void> {
  let forecastCalls = 0;
  await page.route("https://api.open-meteo.com/**", (route) => {
    forecastCalls++;
    return route.fulfill({ json: FORECAST, headers: { "access-control-allow-origin": "*" } });
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("kid-board", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const store = db.transaction("doc", "readwrite").objectStore("doc");
          const get = store.get("main");
          get.onsuccess = () => {
            const doc = get.result;
            doc.settings.location = { name: "서울", admin1: null, latitude: 37.57, longitude: 126.98 };
            const put = store.put(doc, "main");
            put.onsuccess = () => {
              db.close();
              resolve();
            };
            put.onerror = () => reject(put.error);
          };
        };
      }),
  );
  await page.reload();
  await expect(page.locator(".panel")).toHaveCount(2);
  await expect(page.locator(".weather-temp")).toHaveText("3°");
  expect(forecastCalls).toBeGreaterThan(0);
}

export function panel(page: Page, index: number) {
  return page.locator(".panel").nth(index);
}
