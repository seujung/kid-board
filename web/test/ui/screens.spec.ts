import { expect, test } from "@playwright/test";
import { SHOTS, expectInViewport, open, panel, withSeoulWeather } from "./support";

test("morning Thu 07:42", async ({ page }) => {
  await open(page, "2026-11-19T07:42:00+09:00");
  await withSeoulWeather(page);
  await expect(page.locator(".umbrella")).toHaveText("☂️ 우산 챙기기!");
  await expectInViewport(page, ".panel");
  await expect(panel(page, 0).locator(".countdown-label")).toHaveText("등교까지");
  await expect(panel(page, 0).locator(".section-title")).toHaveText("아침 할 일 0/5");
  for (const i of [0, 1]) {
    const cards = panel(page, i).locator(".task-card");
    await expect(cards).toHaveCount(5);
    await expectInViewport(page, `.panel:nth-child(${i + 1}) .task-card`);
  }
  // 첫째는 3개, 둘째는 1개를 끝냅니다.
  for (const n of [0, 1, 2]) await panel(page, 0).locator(".task-card").nth(n).click();
  await panel(page, 1).locator(".task-card").nth(0).click();
  await expect(panel(page, 0).locator(".stamp")).toHaveCount(3);
  await expect(panel(page, 0).locator(".task-card").nth(3).locator(".now-badge")).toHaveText("지금 하자!");
  await expect(panel(page, 0).locator(".countdown-remaining")).toHaveText("할 일 2개 남았어!");
  // 할 일 5개가 패널 안에서 스크롤 없이 보입니다.
  for (const i of [0, 1]) {
    const scroll = panel(page, i).locator(".task-scroll");
    const fits = await scroll.evaluate((el) => el.scrollHeight <= el.clientHeight);
    expect(fits).toBe(true);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/morning.png` });

  // 완료 카드를 누르면 확인 후 취소합니다.
  await panel(page, 1).locator(".task-card").nth(0).click();
  await expect(panel(page, 1).locator(".dialog-title")).toHaveText("취소할까요?");
  await panel(page, 1).locator(".dialog-yes").click();
  await expect(panel(page, 1).locator(".stamp")).toHaveCount(0);

  // 다른 요일은 읽기 전용입니다.
  await panel(page, 1).locator(".week-cell").nth(4).click();
  await expect(panel(page, 1).locator(".back-today")).toBeVisible();
  await expect(panel(page, 1).locator(".section-title")).toHaveText("11월 20일 금요일 할 일 0/9");
  await page.screenshot({ path: `${SHOTS}/morning-other-day.png` });
  await panel(page, 1).locator(".back-today").click();
  await expect(panel(page, 1).locator(".section-title")).toHaveText("아침 할 일 0/5");
});

test("evening Thu 20:00", async ({ page }) => {
  await open(page, "2026-11-19T20:00:00+09:00");
  await withSeoulWeather(page);
  await expect(page.locator(".umbrella")).toHaveCount(0);
  await expectInViewport(page, ".panel");
  await expect(panel(page, 0).locator(".countdown-label")).toHaveText("잘 준비까지");
  await expect(panel(page, 0).locator(".task-card")).toHaveCount(4);
  for (const n of [0, 1]) await panel(page, 0).locator(".task-card").nth(n).click();
  for (const n of [0, 1, 2, 3]) await panel(page, 1).locator(".task-card").nth(n).click();
  await expect(panel(page, 1).locator(".celebration")).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/evening-celebration.png` });
  await expect(panel(page, 1).locator(".celebration")).toHaveCount(0, { timeout: 4000 });
  await expect(panel(page, 1).locator(".week-cell.today .star-stamp")).toHaveCount(0);
  await expectInViewport(page, ".task-card");
  await page.screenshot({ path: `${SHOTS}/evening.png` });
});

test("no school Sat 10:00", async ({ page }) => {
  await open(page, "2026-11-21T10:00:00+09:00");
  await expect(page.locator(".weather-message")).toHaveText("📍지역을 설정해 주세요");
  await expectInViewport(page, ".panel");
  await expect(panel(page, 0).locator(".section-title")).toHaveText("오늘 할 일 0/4");
  await expect(panel(page, 0).locator(".countdown-label")).toHaveText("잘 준비까지");
  await panel(page, 0).locator(".task-card").nth(0).click();
  await expectInViewport(page, ".task-card");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/no-school.png` });
});

test("after bed Thu 22:30", async ({ page }) => {
  await open(page, "2026-11-19T22:30:00+09:00");
  await withSeoulWeather(page);
  // 야간에는 검은 막이 보드를 덮고 HH:mm 시계만 보입니다.
  const overlay = page.locator(".night-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.locator(".night-clock")).toHaveText("22:30");
  await page.screenshot({ path: `${SHOTS}/night.png` });
  // 막을 누르면 막만 걷히고, 같은 터치가 아래 카드로 가지 않습니다.
  const card = panel(page, 0).locator(".task-card").nth(0);
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(overlay).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(card).not.toHaveClass(/shake/);
  await expectInViewport(page, ".panel");
  await expect(panel(page, 0).locator(".finished-text")).toHaveText("내일 또 해 보자");
  await expect(panel(page, 0).locator(".now-badge")).toHaveCount(0);
  // 마감이 지난 카드는 흔들리기만 합니다.
  await panel(page, 0).locator(".task-card").nth(0).click();
  await expect(panel(page, 0).locator(".task-card").nth(0)).toHaveClass(/shake-b/);
  await expect(panel(page, 0).locator(".stamp")).toHaveCount(0);
  await expectInViewport(page, ".task-card");
  await page.screenshot({ path: `${SHOTS}/after-bed.png` });
});
