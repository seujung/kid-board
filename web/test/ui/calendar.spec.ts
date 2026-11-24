import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { SHOTS, W, expectInViewport, open, panel } from "./support";

const THU_MORNING = "2026-11-19T07:42:00+09:00";

const SCHOOL_ID = "15ba96fff7869d387b82de14901466134c4291a0c3f7523411471c4e1cbd16ce@group.calendar.google.com";
const SCHOOL_IFRAME =
  '<iframe src="https://calendar.google.com/calendar/embed?src=15ba96fff7869d387b82de14901466134c4291a0c3f7523411471c4e1cbd16ce%40group.calendar.google.com&ctz=Asia%2FSeoul" style="border: 0" width="800" height="600" frameborder="0" scrolling="no"></iframe>';

const ACADEMY_ID = "academy123@group.calendar.google.com";
const ACADEMY_IFRAME =
  '<iframe src="https://calendar.google.com/calendar/embed?src=academy123%40group.calendar.google.com&amp;ctz=Asia%2FSeoul&amp;color=%23D50000" style="border: 0" width="800" height="600" frameborder="0" scrolling="no"></iframe>';

async function mockGoogleCalendarEmbed(page: Page): Promise<{ getCalls: () => number }> {
  let calls = 0;
  await page.route("https://calendar.google.com/calendar/embed**", (route) => {
    calls += 1;
    const url = new URL(route.request().url());
    const srcs = url.searchParams.getAll("src");
    const dates = url.searchParams.get("dates") ?? "";
    const html = `<!doctype html><html lang="ko"><body><div id="agenda" data-dates="${dates}">${srcs.join(",")}</div></body></html>`;
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
  });
  return { getCalls: () => calls };
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => {
    const body = document.querySelector(".p-body");
    return {
      doc: document.documentElement.scrollWidth,
      body: body ? body.scrollWidth - body.clientWidth : 0,
    };
  });
  expect(widths.doc).toBeLessThanOrEqual(W);
  expect(widths.body).toBeLessThanOrEqual(0);
}

test("register multiple Google calendars per child and show today agenda on board", async ({ page }) => {
  const embedMock = await mockGoogleCalendarEmbed(page);
  await open(page, THU_MORNING);

  // 초기 상태에는 캘린더 영역이 없습니다.
  await expect(page.locator(".calendar-section")).toHaveCount(0);

  // 부모 모드 > 자녀 관리 > 첫째 수정
  await page.locator(".settings-button").click();
  await page.locator(".p-menu-item", { hasText: "자녀 관리" }).click();
  await page.locator(".p-row-main", { hasText: "첫째" }).click();
  await expect(page.locator(".cal-empty")).toHaveText("등록된 캘린더가 없어요.");

  // 잘못된 주소는 오류를 보여 줍니다.
  await page.getByLabel("구글 캘린더 코드").fill("https://evil.com/calendar/embed?src=bad@example.com");
  await page.getByRole("button", { name: "＋ 캘린더 추가" }).click();
  await expect(page.locator(".cal-add-box .p-error")).toHaveText(
    "Google 캘린더 주소(calendar.google.com)만 등록할 수 있어요.",
  );

  // 첫 번째 캘린더(학교) 추가
  await page.getByLabel("캘린더 이름").fill("학교");
  await page.getByLabel("구글 캘린더 코드").fill(SCHOOL_IFRAME);
  await page.getByRole("button", { name: "＋ 캘린더 추가" }).click();
  await expect(page.locator(".cal-row")).toHaveCount(1);
  await expect(page.locator(".cal-title").first()).toHaveText("학교");

  // 같은 캘린더를 다시 넣으면 중복 오류를 보여 줍니다.
  await page.getByLabel("구글 캘린더 코드").fill(SCHOOL_IFRAME);
  await page.getByRole("button", { name: "＋ 캘린더 추가" }).click();
  await expect(page.locator(".cal-add-box .p-error")).toHaveText("이미 등록된 캘린더예요.");

  // 두 번째 캘린더(학원) 추가
  await page.getByLabel("캘린더 이름").fill("학원");
  await page.getByLabel("구글 캘린더 코드").fill(ACADEMY_IFRAME);
  await page.getByRole("button", { name: "＋ 캘린더 추가" }).click();
  await expect(page.locator(".cal-row")).toHaveCount(2);
  await expect(page.locator(".cal-title")).toHaveText(["학교", "학원"]);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-child-calendars.png` });

  // 저장 후 자녀 목록에 개수가 표시됩니다.
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".p-row").first()).toContainText("캘린더 2개");
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();

  // 첫째 패널에 오늘 일정과 두 캘린더가 표시되고, 둘째 패널에는 표시되지 않습니다.
  const firstPanel = panel(page, 0);
  const secondPanel = panel(page, 1);
  await expect(firstPanel.locator(".calendar-section")).toHaveCount(1);
  await expect(firstPanel.locator(".calendar-count")).toHaveText("2개");
  await expect(secondPanel.locator(".calendar-section")).toHaveCount(0);

  const iframe = firstPanel.locator("iframe.calendar-frame");
  await expect(iframe).toBeVisible();
  const srcAttr = await iframe.getAttribute("src");
  expect(srcAttr).toBeTruthy();
  const embedUrl = new URL(srcAttr!);
  expect(embedUrl.searchParams.get("mode")).toBe("AGENDA");
  expect(embedUrl.searchParams.get("dates")).toBe("20261119/20261119");
  expect(embedUrl.searchParams.get("ctz")).toBe("Asia/Seoul");
  expect(embedUrl.searchParams.getAll("src")).toEqual([SCHOOL_ID, ACADEMY_ID]);
  expect(embedUrl.searchParams.getAll("color")).toEqual(["#D50000"]);

  await expectInViewport(page, ".panel");
  await expectInViewport(page, ".calendar-frame-wrap");
  await expect.poll(() => embedMock.getCalls()).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/board-with-calendar.png` });

  // 새로고침 버튼을 누르면 일정 iframe을 다시 불러옵니다.
  const callsBeforeRefresh = embedMock.getCalls();
  await firstPanel.getByRole("button", { name: "일정 새로고침" }).click();
  await expect.poll(() => embedMock.getCalls()).toBeGreaterThan(callsBeforeRefresh);

  // 페이지를 새로고침해도 IndexedDB에서 캘린더가 유지됩니다.
  await page.reload();
  await expect(panel(page, 0).locator(".calendar-section")).toHaveCount(1);
  await expect(panel(page, 0).locator(".calendar-count")).toHaveText("2개");

  // 부모 모드에서 캘린더 하나를 삭제하고 저장합니다.
  await page.locator(".settings-button").click();
  await page.locator(".p-menu-item", { hasText: "자녀 관리" }).click();
  await page.locator(".p-row-main", { hasText: "첫째" }).click();
  await page.getByRole("button", { name: "학교 캘린더 삭제" }).click();
  await expect(page.locator(".cal-row")).toHaveCount(1);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".p-row").first()).toContainText("캘린더 1개");

  // 둘째는 입력 칸에 붙여 넣은 채 추가 버튼을 누르지 않고 저장해도 함께 등록됩니다.
  await page.locator(".p-row-main", { hasText: "둘째" }).click();
  await page.getByLabel("구글 캘린더 코드").fill(SCHOOL_IFRAME);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".p-row").nth(1)).toContainText("캘린더 1개");
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();

  await expect(panel(page, 0).locator(".calendar-count")).toHaveCount(0);
  const firstSrcAfter = new URL((await panel(page, 0).locator("iframe.calendar-frame").getAttribute("src"))!);
  expect(firstSrcAfter.searchParams.getAll("src")).toEqual([ACADEMY_ID]);
  await expect(panel(page, 1).locator(".calendar-section")).toHaveCount(1);
});
