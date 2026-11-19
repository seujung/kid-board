import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { FORECAST, SHOTS, W, open, panel } from "./support";

const THU_MORNING = "2026-11-19T07:42:00+09:00";
const GEOCODING = JSON.parse(readFileSync(new URL("../fixtures/geocoding.json", import.meta.url), "utf8"));
const MENU = [
  "자녀 관리",
  "할 일 관리",
  "시각 설정",
  "화면 끄기 시간",
  "소리",
  "날씨 지역",
  "완료 기록",
  "백업",
];

/** 화면이 1024px 안에 들어가고 가로 스크롤이 없는지 봅니다. */
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

/** 설정 아이콘을 눌러 부모 모드 첫 화면을 엽니다. */
async function openParent(page: Page): Promise<void> {
  await page.locator(".settings-button").click();
  await expect(page.locator(".p-topbar-title")).toHaveText("부모 모드");
}

async function openMenu(page: Page, title: string): Promise<void> {
  await page.locator(".p-menu-item", { hasText: title }).click();
  await expect(page.locator(".p-topbar-title")).toHaveText(title);
}

async function backToMenu(page: Page): Promise<void> {
  await page.locator(".p-back").click();
  await expect(page.locator(".p-topbar-title")).toHaveText("부모 모드");
}

test("one tap opens parent mode, add a task", async ({ page }) => {
  await open(page, THU_MORNING);
  await page.screenshot({ path: `${SHOTS}/parent-board-icon.png` });

  // 설정 아이콘은 날씨 카드와 겹치지 않고 64px 누름 영역을 가집니다.
  const icon = await page.locator(".settings-button").boundingBox();
  const card = await page.locator(".weather-card").boundingBox();
  expect(icon && card).toBeTruthy();
  if (icon && card) {
    expect(icon.width).toBe(64);
    expect(icon.height).toBe(64);
    expect(icon.x + icon.width).toBeLessThanOrEqual(W);
    expect(card.x + card.width).toBeLessThanOrEqual(icon.x);
  }

  // 1. 한 번 누르면 PIN 없이 바로 부모 모드가 열립니다.
  await openParent(page);
  await expect(page.locator(".pin-pad")).toHaveCount(0);
  const items = page.locator(".p-menu-title");
  await expect(items).toHaveText(MENU);
  await expect(page.locator(".p-version")).toContainText("현재 버전");
  await expect(page.locator(".p-update")).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-home.png` });

  // 2. 할 일 관리에서 첫째의 아침 할 일 "이 닦기"를 더합니다.
  await openMenu(page, "할 일 관리");
  await expect(page.locator(".p-segment-item.on")).toContainText("첫째");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-tasks.png` });
  await page.locator(".p-add", { hasText: "아침 할 일 추가" }).click();
  await expect(page.locator(".p-form-title")).toHaveText("할 일 추가");
  await expect(page.locator(".p-hint")).toHaveText("키보드의 🎤 버튼을 누르면 말로 입력할 수 있어요.");
  await page.locator(".p-form input[type=text]").fill("이 닦기");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-task-editor.png` });
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".p-row-title", { hasText: "이 닦기" })).toHaveCount(1);
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();
  await expect(page.locator(".parent")).toHaveCount(0);
  await expect(panel(page, 0).locator(".task-card", { hasText: "이 닦기" })).toHaveCount(1);
  await expect(panel(page, 1).locator(".task-card", { hasText: "이 닦기" })).toHaveCount(0);

  // 3. 다시 누르면 다시 바로 열립니다.
  await openParent(page);
});

test("every parent screen fits 1024x768", async ({ page }) => {
  let geocodingCalls = 0;
  let forecastCalls = 0;
  await page.route("https://geocoding-api.open-meteo.com/**", (route) => {
    geocodingCalls++;
    return route.fulfill({ json: GEOCODING, headers: { "access-control-allow-origin": "*" } });
  });
  await page.route("https://api.open-meteo.com/**", (route) => {
    forecastCalls++;
    return route.fulfill({ json: FORECAST, headers: { "access-control-allow-origin": "*" } });
  });
  await open(page, THU_MORNING);
  await openParent(page);

  // 자녀 관리
  await openMenu(page, "자녀 관리");
  await expect(page.locator(".p-row-title")).toHaveText(["첫째", "둘째"]);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-children.png` });
  await page.locator(".p-row-main", { hasText: "첫째" }).click();
  await expect(page.locator(".p-form-title")).toHaveText("자녀 수정");
  await expect(page.locator(".p-hint")).toHaveText("키보드의 🎤 버튼을 누르면 말로 입력할 수 있어요.");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-child-editor.png` });
  await page.getByRole("button", { name: "취소" }).click();
  // 순서를 바꾸면 보드 패널 순서도 바뀝니다.
  await page.locator(".p-row").nth(1).getByRole("button", { name: "위로" }).click();
  await expect(page.locator(".p-row-title")).toHaveText(["둘째", "첫째"]);
  await page.locator(".p-row").nth(1).getByRole("button", { name: "위로" }).click();
  await expect(page.locator(".p-row-title")).toHaveText(["첫째", "둘째"]);
  await backToMenu(page);

  // 시각 설정: 잘 준비 시각이 등교 시각보다 빠르면 저장할 수 없습니다.
  await openMenu(page, "시각 설정");
  await expect(page.locator(".times-row")).toHaveCount(7);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-times.png` });
  const bedHour = page.getByLabel("월 잘 준비 시각 시", { exact: true });
  await bedHour.selectOption("7");
  await expect(page.locator(".times-row").first().locator(".p-error")).toHaveText("잘 준비 시각은 등교 시각보다 늦어야 해요");
  await expect(page.getByRole("button", { name: "저장" })).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/parent-times-error.png` });
  // 다른 자녀를 보고 있어도 저장할 수 없는 이유를 보여 줍니다.
  await page.locator(".p-segment-item", { hasText: "둘째" }).click();
  await expect(page.locator(".p-error")).toHaveText("잘 준비 시각은 등교 시각보다 늦어야 해요");
  await page.locator(".p-segment-item", { hasText: "첫째" }).click();
  await bedHour.selectOption("21");
  await page.getByLabel("월 잘 준비 시각 분", { exact: true }).selectOption("0");
  await expect(page.locator(".p-error")).toHaveCount(0);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".p-notice")).toHaveText("저장했어요");
  await backToMenu(page);

  // 화면 끄기 시간: 기본은 매일 22:00~06:00 한 구간입니다.
  await openMenu(page, "화면 끄기 시간");
  const dimRows = page.locator(".dim-row");
  await expect(dimRows).toHaveCount(1);
  await expect(page.getByLabel("구간 1 시작 시", { exact: true })).toHaveValue("22");
  await expect(page.getByLabel("구간 1 끝 시", { exact: true })).toHaveValue("6");
  await expect(dimRows.first().locator(".weekday-toggle.on")).toHaveCount(7);
  await expect(page.locator(".p-footnote")).toHaveText(
    "이 시간에는 화면을 어둡게 하고 시계만 보여 줘요. 화면을 누르면 30초 동안 보드를 보여 줘요.",
  );
  const dimSave = page.getByRole("button", { name: "저장" });
  await expect(dimSave).toBeDisabled();
  // 새 구간은 월~금 09:00~14:00입니다.
  await page.locator(".p-add", { hasText: "구간 추가" }).click();
  await expect(dimRows).toHaveCount(2);
  await expect(page.getByLabel("구간 2 시작 시", { exact: true })).toHaveValue("9");
  await expect(page.getByLabel("구간 2 끝 시", { exact: true })).toHaveValue("14");
  await expect(dimRows.nth(1).locator(".weekday-toggle.on")).toHaveText(["월", "화", "수", "목", "금"]);
  await expect(dimSave).toBeEnabled();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-dim.png` });
  // 요일을 모두 끄면 저장할 수 없습니다.
  for (const d of ["월", "화", "수", "목", "금"]) await page.getByLabel(`구간 2 ${d}요일`, { exact: true }).click();
  await expect(dimRows.nth(1).locator(".p-error")).toHaveText("요일을 하나 이상 고르세요");
  await expect(dimSave).toBeDisabled();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-dim-error.png` });
  await page.getByLabel("구간 2 토요일", { exact: true }).click();
  await expect(page.locator(".p-error")).toHaveCount(0);
  await dimSave.click();
  await expect(page.locator(".p-notice")).toHaveText("저장했어요");
  await expect(dimSave).toBeDisabled();
  // 구간을 모두 지우면 안내 문구를 보여 줍니다. 저장하지 않고 나가면 버립니다.
  await page.getByRole("button", { name: "구간 2 지우기" }).click();
  await page.getByRole("button", { name: "구간 1 지우기" }).click();
  await expect(page.locator(".dim-empty")).toHaveText("화면 끄기 시간이 없어요. 화면이 항상 켜져 있어요.");
  await expect(dimSave).toBeEnabled();
  await page.screenshot({ path: `${SHOTS}/parent-dim-empty.png` });
  await backToMenu(page);
  await openMenu(page, "화면 끄기 시간");
  await expect(dimRows).toHaveCount(2);
  await backToMenu(page);

  // 소리: 켜기, 크기, 들어 보기, 안내 문구입니다.
  await openMenu(page, "소리");
  await expect(page.getByRole("switch", { name: "소리 켜기" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".p-segment-item")).toHaveText(["작게", "보통", "크게"]);
  await expect(page.locator(".p-segment-item.on")).toHaveText("보통");
  await expect(page.getByRole("button", { name: "띵 들어 보기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "빵빠레 들어 보기" })).toBeVisible();
  await expect(page.locator(".p-footnote")).toHaveText(
    "iPad 음량 버튼과 제어 센터의 음소거 설정에 따라 소리가 작거나 들리지 않을 수 있어요.",
  );
  await expectNoHorizontalScroll(page);
  const soundFits = await page.locator(".p-body").evaluate((el) => el.scrollHeight <= el.clientHeight);
  expect(soundFits).toBe(true);
  await page.screenshot({ path: `${SHOTS}/parent-sound.png` });
  await backToMenu(page);

  // 날씨 지역: 고르면 저장하고 보드의 날씨를 바로 다시 가져옵니다.
  await openMenu(page, "날씨 지역");
  await expect(page.locator(".p-current")).toHaveText("아직 정하지 않았어요");
  // 내장 목록을 먼저 보여 줍니다. 5개보다 적으면 Open-Meteo 결과를 뒤에 붙입니다.
  await page.locator(".p-search input").fill("송파");
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.locator(".place-result")).toHaveText(["송파구, 서울특별시", "서울특별시", "성남시, 경기도"]);
  expect(geocodingCalls).toBe(1);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-location.png` });
  // 내장 결과가 5개 이상이면 네트워크를 쓰지 않습니다. 일반구는 시 이름을 붙여 보여 줍니다.
  await page.locator(".p-search input").fill("성남");
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.locator(".place-result").first()).toHaveText("성남시, 경기도");
  await expect(page.locator(".place-result", { hasText: "성남시 분당구, 경기도" })).toHaveCount(1);
  expect(geocodingCalls).toBe(2);
  await page.locator(".p-search input").fill("서울");
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.locator(".place-result")).toHaveCount(26);
  await expect(page.locator(".place-result").first()).toHaveText("서울특별시");
  expect(geocodingCalls).toBe(2);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-location-seoul.png` });
  await page.locator(".p-search input").fill("송파");
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.locator(".place-result").first()).toHaveText("송파구, 서울특별시");
  const before = forecastCalls;
  await page.locator(".place-result", { hasText: "송파구" }).click();
  await expect(page.locator(".p-status")).toHaveText("송파구, 서울특별시(으)로 바꿨어요. 날씨를 새로 가져와요.");
  await expect(page.locator(".p-current")).toHaveText("송파구, 서울특별시");
  await expect.poll(() => forecastCalls).toBeGreaterThan(before);
  await backToMenu(page);

  // 완료 기록
  await openMenu(page, "완료 기록");
  await expect(page.locator(".history tbody tr")).toHaveCount(28);
  await expect(page.locator(".history tbody tr").first().locator("td").first()).toHaveText("11/19 (목)");
  await expect(page.locator(".history tbody tr").first().locator("td").nth(1)).toHaveText("0/9");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-history.png` });
  await backToMenu(page);

  // 백업: 파일 공유를 못 하면 내려받습니다.
  await page.evaluate(() => Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined }));
  await openMenu(page, "백업");
  await expect(page.locator(".p-guide")).toContainText("공유 화면에서 '파일에 저장' > iCloud Drive를 고르세요.");
  await expect(page.locator(".p-guide")).toContainText(
    "백업·복원 전에 홈 버튼을 세 번 눌러 사용법 유도 접근을 잠시 끄십시오.",
  );
  await expect(page.locator(".p-current")).toHaveText("아직 백업하지 않았어요");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-backup.png` });
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "백업 파일 저장" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("kid-board-backup-20261119.json");
  const backupPath = test.info().outputPath("backup.json");
  await download.saveAs(backupPath);
  await expect(page.locator(".p-ok")).toHaveText("백업 파일을 내려받았어요");
  await expect(page.locator(".p-current")).toHaveText("마지막 백업: 2026년 11월 19일");
  const backup = JSON.parse(readFileSync(backupPath, "utf8"));
  expect(JSON.stringify(backup)).not.toContain("pinHash");

  // 형식이 맞지 않는 파일은 아무것도 바꾸지 않습니다.
  await page.locator(".p-file").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(page.locator(".p-error")).toHaveText("백업 파일을 읽을 수 없어요");

  // 할 일을 하나 지운 뒤 백업에서 복원하면 돌아옵니다.
  await backToMenu(page);
  await openMenu(page, "할 일 관리");
  const firstTitle = (await page.locator(".p-row-title").first().textContent()) ?? "";
  await page.locator(".p-row").first().getByRole("button", { name: "지우기" }).click();
  await expect(page.locator(".p-dialog-title")).toHaveText("이 할 일을 지울까요?");
  await page.locator(".p-dialog").getByRole("button", { name: "지우기" }).click();
  await expect(page.locator(".p-row-title", { hasText: firstTitle })).toHaveCount(0);
  await backToMenu(page);
  await openMenu(page, "백업");
  await page.locator(".p-file").setInputFiles(backupPath);
  await expect(page.locator(".p-dialog-title")).toHaveText("지금 데이터를 백업 내용으로 바꿀까요?");
  await page.screenshot({ path: `${SHOTS}/parent-restore-confirm.png` });
  await page.getByRole("button", { name: "바꾸기" }).click();
  await expect(page.locator(".p-ok")).toHaveText("백업 내용으로 바꿨어요");
  await backToMenu(page);
  await openMenu(page, "할 일 관리");
  await expect(page.locator(".p-row-title", { hasText: firstTitle })).toHaveCount(1);
  await backToMenu(page);

  // 파일 공유를 지원하면 공유 시트를 엽니다.
  await page.evaluate(() => {
    const w = window as unknown as { sharedName?: string };
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        w.sharedName = data.files?.[0]?.name;
      },
    });
  });
  await openMenu(page, "백업");
  await page.getByRole("button", { name: "백업 파일 저장" }).click();
  await expect(page.locator(".p-ok")).toHaveText("백업 파일을 보냈어요");
  expect(await page.evaluate(() => (window as unknown as { sharedName?: string }).sharedName)).toBe(
    "kid-board-backup-20261119.json",
  );
  await backToMenu(page);

  // 지역을 바꾼 날씨가 보드에 보입니다.
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();
  await expect(page.locator(".weather-sub")).toHaveText("송파구");
  await page.screenshot({ path: `${SHOTS}/parent-board-after.png` });
});

test("backup reminder after 7 days", async ({ page }) => {
  await open(page, THU_MORNING);
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
            doc.settings.lastBackupAt = new Date("2026-11-09T07:00:00+09:00").getTime();
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
  // 보드에는 안내를 표시하지 않습니다.
  await expect(page.getByText("백업한 지")).toHaveCount(0);
  await openParent(page);
  await expect(page.locator(".p-warning")).toHaveText("백업한 지 10일 지났어요");
  await page.screenshot({ path: `${SHOTS}/parent-home-backup-reminder.png` });
});

test("idle for 2 minutes returns to the board", async ({ page }) => {
  await openParentWithFakeClock(page);
  await openMenu(page, "할 일 관리");
  await page.locator(".p-add", { hasText: "아침 할 일 추가" }).click();
  await page.locator(".p-form input[type=text]").fill("저장 안 한 할 일");

  // 입력하면 다시 셉니다.
  await page.clock.runFor(100_000);
  await expect(page.locator(".parent")).toHaveCount(1);
  await page.locator(".p-form input[type=text]").press("End");
  await page.clock.runFor(100_000);
  await expect(page.locator(".parent")).toHaveCount(1);
  await page.clock.runFor(21_000);
  await expect(page.locator(".parent")).toHaveCount(0);
  await expect(page.getByText("저장 안 한 할 일")).toHaveCount(0);
});

/** 시계를 멈춘 채 설정 아이콘을 눌러 부모 모드를 엽니다. */
async function openParentWithFakeClock(page: Page): Promise<void> {
  await page.clock.install({ time: new Date(THU_MORNING) });
  await page.goto("./");
  await expect(page.locator(".panel")).toHaveCount(2);
  await openParent(page);
}

const IDLE_MS = 120_000;
const CAP_MS = 600_000;

test("idle timer pauses while the share sheet is open, for at most 10 minutes", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    // 부모가 공유 시트를 열어 둔 채로 둡니다.
    Object.defineProperty(navigator, "share", { configurable: true, value: () => new Promise(() => undefined) });
  });
  await openParentWithFakeClock(page);
  await openMenu(page, "백업");
  await page.getByRole("button", { name: "백업 파일 저장" }).click();
  await page.clock.runFor(CAP_MS - 1000);
  await expect(page.locator(".parent")).toHaveCount(1);
  await page.clock.runFor(1000 + IDLE_MS + 1000);
  await expect(page.locator(".parent")).toHaveCount(0);
});

test("a backup file picked after parent mode closed still reaches the restore confirm", async ({ page }) => {
  await openParentWithFakeClock(page);
  const backup = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const req = indexedDB.open("kid-board", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction("doc", "readonly").objectStore("doc").get("main");
          get.onsuccess = () => {
            const doc = get.result;
            db.close();
            resolve(JSON.stringify({ schemaVersion: doc.schemaVersion, data: doc.data, settings: { location: null, didSeed: true, lastBackupAt: null }, weather: null }));
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
  await openMenu(page, "백업");
  const choosing = page.waitForEvent("filechooser");
  await page.locator(".backup-restore").click();
  const chooser = await choosing;
  // 파일 선택이 열려 있는 동안에는 닫지 않습니다.
  await page.clock.runFor(5 * 60_000);
  await expect(page.locator(".p-topbar-title")).toHaveText("백업");
  // iOS는 취소를 알려 주지 않으므로 10분 뒤에는 다시 세고, 2분 뒤에 닫습니다.
  await page.clock.runFor(5 * 60_000 + IDLE_MS + 1000);
  await expect(page.locator(".parent")).toHaveCount(0);
  // 그 뒤에 고른 파일도 버리지 않습니다. 부모 모드를 다시 열고 복원 확인 창을 보여 줍니다.
  await chooser.setFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(backup) });
  await expect(page.locator(".p-topbar-title")).toHaveText("백업");
  await expect(page.locator(".p-dialog-title")).toHaveText("지금 데이터를 백업 내용으로 바꿀까요?");
  await page.getByRole("button", { name: "바꾸기" }).click();
  await expect(page.locator(".p-ok")).toHaveText("백업 내용으로 바꿨어요");
});

test("screen-off period dims the board in the daytime", async ({ page }) => {
  await open(page, "2026-11-19T08:58:00+09:00");
  await openParent(page);
  await openMenu(page, "화면 끄기 시간");
  await page.getByRole("button", { name: "구간 1 지우기" }).click();
  await page.locator(".p-add", { hasText: "구간 추가" }).click();
  await page.getByLabel("구간 1 시작 시", { exact: true }).selectOption("8");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".p-notice")).toHaveText("저장했어요");
  // 부모 모드가 열려 있는 동안에는 어둡게 하지 않습니다.
  await expect(page.locator(".night-overlay")).toHaveCount(0);
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();
  const overlay = page.locator(".night-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.locator(".night-clock")).toHaveText(/^08:5[89]$/);
  await page.screenshot({ path: `${SHOTS}/dim-daytime.png` });
  // 누르면 30초 동안 보드를 보여 줍니다.
  await overlay.click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator(".panel")).toHaveCount(2);
});
