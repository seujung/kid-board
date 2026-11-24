import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { SHOTS, W, expectInViewport, open, panel } from "./support";

// 목요일 14:20: 등교(08:00-08:30, 지남), 영어(14:00-15:00, 진행 중), 피아노(16:00-17:00, 다음), 저녁 독서(19:00-19:30, 예정)
const THU_AFTERNOON = "2026-11-24T14:20:00+09:00";

const PROXY_URL = "https://proxy.example.test/ics";
const SCHOOL_ICAL =
  "https://calendar.google.com/calendar/ical/15ba96fff7869d387b82de14901466134c4291a0c3f7523411471c4e1cbd16ce%40group.calendar.google.com/private-schooltoken123/basic.ics";
const ACADEMY_ICAL =
  "https://calendar.google.com/calendar/ical/academy123%40group.calendar.google.com/private-academytoken456/basic.ics";

const SCHOOL_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:sch-allday",
  "DTSTART;VALUE=DATE:20261124",
  "DTEND;VALUE=DATE:20261125",
  "SUMMARY:현장체험학습",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:sch-morning",
  "DTSTART;TZID=Asia/Seoul:20261124T080000",
  "DTEND;TZID=Asia/Seoul:20261124T083000",
  "SUMMARY:아침 조회",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:sch-english",
  "DTSTART;TZID=Asia/Seoul:20261124T140000",
  "DTEND;TZID=Asia/Seoul:20261124T150000",
  "SUMMARY:영어 방과후",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const ACADEMY_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:aca-piano",
  "DTSTART;TZID=Asia/Seoul:20261117T160000",
  "DTEND;TZID=Asia/Seoul:20261117T170000",
  "RRULE:FREQ=WEEKLY;BYDAY=TU",
  "SUMMARY:피아노 학원",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:aca-reading",
  "DTSTART;TZID=Asia/Seoul:20261124T190000",
  "DTEND;TZID=Asia/Seoul:20261124T193000",
  "SUMMARY:독서 논술",
  "END:VEVENT",
].join("\r\n");

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

test("register private iCal calendars with proxy and render today events on board", async ({ page }) => {
  let proxyCalls = 0;
  let failProxy = false;
  await page.route(`${PROXY_URL}**`, (route) => {
    proxyCalls += 1;
    if (failProxy) {
      return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "offline" }) });
    }
    const target = new URL(route.request().url()).searchParams.get("url");
    if (target === SCHOOL_ICAL) {
      return route.fulfill({
        status: 200,
        contentType: "text/calendar; charset=utf-8",
        headers: { "access-control-allow-origin": "*" },
        body: SCHOOL_ICS,
      });
    }
    if (target === ACADEMY_ICAL) {
      return route.fulfill({
        status: 200,
        contentType: "text/calendar; charset=utf-8",
        headers: { "access-control-allow-origin": "*" },
        body: ACADEMY_ICS,
      });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });

  await open(page, THU_AFTERNOON);

  // 초기 상태에는 캘린더 영역이 없습니다.
  await expect(page.locator(".calendar-section")).toHaveCount(0);

  // 부모 모드 > 자녀 관리에서 프록시 주소 설정
  await page.locator(".settings-button").click();
  await page.locator(".p-menu-item", { hasText: "자녀 관리" }).click();
  await page.getByLabel("캘린더 프록시 주소").fill("http://bad.example/proxy");
  await page.locator(".cal-proxy-section").getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".cal-proxy-section .p-error")).toHaveText("https://로 시작하는 프록시 주소를 입력해 주세요.");

  await page.getByLabel("캘린더 프록시 주소").fill(PROXY_URL);
  await page.locator(".cal-proxy-section").getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".cal-proxy-section .p-ok")).toHaveText("프록시 주소를 저장했어요");

  // 첫째 수정: 잘못된 주소·iframe 거부, 비공개 iCal 2개 등록, 비밀 토큰 마스킹 확인
  await page.locator(".p-row-main", { hasText: "첫째" }).click();
  await expect(page.locator(".cal-empty")).toHaveText("등록된 캘린더가 없어요.");

  await page.getByLabel("구글 캘린더 iCal 주소").fill('<iframe src="https://calendar.google.com/calendar/embed?src=a"></iframe>');
  await page.getByRole("button", { name: "＋ 캘린더 추가" }).click();
  await expect(page.locator(".cal-add-box .p-error")).toContainText("iCal 형식의 비공개 주소");

  await page.getByLabel("캘린더 이름").fill("학교");
  await page.getByLabel("구글 캘린더 iCal 주소").fill(SCHOOL_ICAL);
  await page.getByRole("button", { name: "＋ 캘린더 추가" }).click();
  await expect(page.locator(".cal-row")).toHaveCount(1);
  await expect(page.locator(".cal-src").first()).toHaveText("15ba96fff786…@group.calendar.google.com (비공개)");
  expect(await page.locator(".cal-list").innerText()).not.toContain("private-schooltoken123");

  // 중복 등록 거부
  await page.getByLabel("구글 캘린더 iCal 주소").fill(SCHOOL_ICAL);
  await page.getByRole("button", { name: "＋ 캘린더 추가" }).click();
  await expect(page.locator(".cal-add-box .p-error")).toHaveText("이미 등록된 캘린더예요.");

  // 두 번째 캘린더(학원) 추가
  await page.getByLabel("캘린더 이름").fill("학원");
  await page.getByLabel("색 3").click();
  await page.getByLabel("구글 캘린더 iCal 주소").fill(ACADEMY_ICAL);
  await page.getByRole("button", { name: "＋ 캘린더 추가" }).click();
  await expect(page.locator(".cal-row")).toHaveCount(2);
  await expect(page.locator(".cal-title")).toHaveText(["학교", "학원"]);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-child-calendars.png` });

  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".p-row").first()).toContainText("캘린더 2개");
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();

  // 보드 첫째 패널에 5개 오늘 일정이 상태별로 표시됩니다.
  const firstPanel = panel(page, 0);
  const secondPanel = panel(page, 1);
  await expect(firstPanel.locator(".calendar-count")).toHaveText("5");
  await expect(secondPanel.locator(".calendar-section")).toHaveCount(0);

  const items = firstPanel.locator(".cal-event");
  await expect(items).toHaveCount(5);
  await expect(items.nth(0)).toHaveClass(/allDay/);
  await expect(items.nth(0)).toContainText("현장체험학습");
  await expect(items.nth(1)).toHaveClass(/past/);
  await expect(items.nth(1)).toContainText("아침 조회");
  await expect(items.nth(2)).toHaveClass(/ongoing/);
  await expect(items.nth(2)).toContainText("영어 방과후");
  await expect(items.nth(2).locator(".cal-event-badge")).toHaveText("지금");
  await expect(items.nth(3)).toHaveClass(/next/);
  await expect(items.nth(3)).toContainText("피아노 학원");
  await expect(items.nth(3).locator(".cal-event-badge")).toHaveText("다음");
  await expect(items.nth(4)).toHaveClass(/upcoming/);
  await expect(items.nth(4)).toContainText("독서 논술");

  await expectInViewport(page, ".panel");
  await expectInViewport(page, ".calendar-card");
  await page.screenshot({ path: `${SHOTS}/board-with-calendar.png` });

  // 새로고침 버튼으로 재조회합니다.
  const callsBefore = proxyCalls;
  await firstPanel.getByRole("button", { name: "일정 새로고침" }).click();
  await expect.poll(() => proxyCalls).toBeGreaterThan(callsBefore);

  // 프록시 요청이 실패해도 리로드 시 IndexedDB 캐시 일정이 유지됩니다.
  failProxy = true;
  await page.reload();
  await expect(panel(page, 0).locator(".cal-event")).toHaveCount(5);

  // 첫째 캘린더 1개 삭제 + 둘째는 입력 칸에 붙여 넣은 채 바로 저장
  failProxy = false;
  await page.locator(".settings-button").click();
  await page.locator(".p-menu-item", { hasText: "자녀 관리" }).click();
  await page.locator(".p-row-main", { hasText: "첫째" }).click();
  await page.getByRole("button", { name: "학교 캘린더 삭제" }).click();
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".p-row").first()).toContainText("캘린더 1개");

  await page.locator(".p-row-main", { hasText: "둘째" }).click();
  await page.getByLabel("구글 캘린더 iCal 주소").fill(SCHOOL_ICAL);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".p-row").nth(1)).toContainText("캘린더 1개");
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();

  await expect(panel(page, 0).locator(".calendar-count")).toHaveText("2");
  await expect(panel(page, 1).locator(".calendar-count")).toHaveText("3");
});
