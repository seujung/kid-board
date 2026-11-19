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
  "날씨 지역",
  "완료 기록",
  "백업",
  "PIN 변경",
  "복구 코드 새로 만들기",
];

/** 설정 아이콘을 `ms` 동안 누르고 있다가 뗍니다. */
async function pressSettings(page: Page, ms: number): Promise<void> {
  const box = await page.locator(".settings-button").boundingBox();
  if (!box) throw new Error("no settings button");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function typeDigits(page: Page, digits: string): Promise<void> {
  for (const d of digits) await page.locator(".pin-pad").getByRole("button", { name: d, exact: true }).click();
}

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

/** 처음 PIN을 정하고 복구 코드를 확인한 뒤 부모 모드 첫 화면까지 갑니다. 복구 코드를 돌려줍니다. */
async function setUpPin(page: Page, pin: string, shots = false): Promise<string> {
  await pressSettings(page, 3300);
  await expect(page.locator(".pin-title")).toHaveText("새 PIN을 정해 주세요");
  await expect(page.locator(".pin-subtitle")).toHaveText("PIN 4자리를 입력해 주세요");
  if (shots) await page.screenshot({ path: `${SHOTS}/parent-pin-setup.png` });
  await typeDigits(page, pin);
  await expect(page.locator(".pin-subtitle")).toHaveText("한 번 더 입력해 주세요");
  await typeDigits(page, pin);
  const code = page.locator(".recovery-code");
  await expect(code).toHaveText(/^[0-9]{4} [0-9]{4}$/);
  await expect(page.locator(".recovery-note")).toHaveText("이 복구 코드를 따로 적어 두세요. 다시 보여 드리지 않아요.");
  if (shots) await page.screenshot({ path: `${SHOTS}/parent-recovery-code.png` });
  const text = (await code.textContent()) ?? "";
  await page.getByRole("button", { name: "적어 두었어요" }).click();
  await expect(page.locator(".p-topbar-title")).toHaveText("부모 모드");
  return text.replace(" ", "");
}

async function openMenu(page: Page, title: string): Promise<void> {
  await page.locator(".p-menu-item", { hasText: title }).click();
  await expect(page.locator(".p-topbar-title")).toHaveText(title);
}

async function backToMenu(page: Page): Promise<void> {
  await page.locator(".p-back").click();
  await expect(page.locator(".p-topbar-title")).toHaveText("부모 모드");
}

test("long press, PIN setup, add task, lockout", async ({ page }) => {
  await open(page, THU_MORNING);
  await page.screenshot({ path: `${SHOTS}/parent-board-icon.png` });

  // 설정 아이콘은 날씨 카드와 겹치지 않고 44px 누름 영역을 가집니다.
  const icon = await page.locator(".settings-button").boundingBox();
  const card = await page.locator(".weather-card").boundingBox();
  expect(icon && card).toBeTruthy();
  if (icon && card) {
    expect(icon.width).toBe(44);
    expect(icon.height).toBe(44);
    expect(icon.x + icon.width).toBeLessThanOrEqual(W);
    expect(card.x + card.width).toBeLessThanOrEqual(icon.x);
  }

  // 1. 1초만 누르면 열리지 않습니다.
  await pressSettings(page, 1000);
  await page.waitForTimeout(2500);
  await expect(page.locator(".parent")).toHaveCount(0);

  // 2. 3초 누르면 PIN을 정하고 복구 코드를 봅니다.
  await setUpPin(page, "1234", true);
  const items = page.locator(".p-menu-title");
  await expect(items).toHaveText(MENU);
  await expect(page.locator(".p-version")).toContainText("현재 버전");
  await expect(page.locator(".p-update")).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-home.png` });

  // 3. 할 일 관리에서 첫째의 아침 할 일 "이 닦기"를 더합니다.
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

  // 4. 다시 열고 틀린 PIN을 5번 넣으면 잠깁니다.
  await pressSettings(page, 3300);
  await expect(page.locator(".pin-title")).toHaveText("PIN을 입력해 주세요");
  await expect(page.getByRole("button", { name: "PIN을 잊었어요" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/parent-gate.png` });
  await typeDigits(page, "0000");
  await expect(page.locator(".pin-message")).toHaveText("PIN이 맞지 않아요");
  for (let i = 0; i < 4; i++) {
    await expect(page.locator(".pin-key").first()).toBeEnabled();
    await typeDigits(page, "0000");
  }
  await expect(page.locator(".pin-message")).toHaveText("잠시 후 다시 해 주세요 (60초)");
  await expect(page.locator(".pin-key").first()).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/parent-locked.png` });
  // 1초마다 남은 초를 다시 셉니다.
  await expect(page.locator(".pin-message")).toHaveText("잠시 후 다시 해 주세요 (59초)", { timeout: 2500 });

  // 잠금은 저장되므로 닫았다 다시 열어도 남아 있습니다.
  await page.getByRole("button", { name: "닫기" }).click();
  await pressSettings(page, 3300);
  await expect(page.locator(".pin-message")).toHaveText(/잠시 후 다시 해 주세요 \(5[0-9]초\)/);
});

test("recovery code resets PIN and keeps the code", async ({ page }) => {
  await open(page, THU_MORNING);
  const code = await setUpPin(page, "1234");
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();

  await pressSettings(page, 3300);
  await page.getByRole("button", { name: "PIN을 잊었어요" }).click();
  await expect(page.locator(".pin-title")).toHaveText("복구 코드를 입력해 주세요");
  await expect(page.locator(".pin-dot")).toHaveCount(8);
  const wrong = code === "00000000" ? "11111111" : "00000000";
  await typeDigits(page, wrong);
  await expect(page.locator(".pin-message")).toHaveText("복구 코드가 맞지 않아요");
  await typeDigits(page, code.slice(0, 5));
  await page.screenshot({ path: `${SHOTS}/parent-recovery-entry.png` });
  await typeDigits(page, code.slice(5));
  await expect(page.locator(".pin-title")).toHaveText("새 PIN을 정해 주세요");
  await typeDigits(page, "5678");
  await typeDigits(page, "5678");
  // 복구 코드는 그대로 유지하므로 다시 보여 주지 않습니다.
  await expect(page.locator(".p-topbar-title")).toHaveText("부모 모드");
  await expect(page.locator(".recovery-code")).toHaveCount(0);
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();

  await pressSettings(page, 3300);
  await typeDigits(page, "1234");
  await expect(page.locator(".pin-message")).toHaveText("PIN이 맞지 않아요");
  await typeDigits(page, "5678");
  await expect(page.locator(".p-topbar-title")).toHaveText("부모 모드");
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();

  // 같은 복구 코드를 다시 쓸 수 있습니다.
  await pressSettings(page, 3300);
  await page.getByRole("button", { name: "PIN을 잊었어요" }).click();
  await typeDigits(page, code);
  await expect(page.locator(".pin-title")).toHaveText("새 PIN을 정해 주세요");
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
  await setUpPin(page, "1234");

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
  const bed = page.getByLabel("월 잘 준비 시각");
  await bed.fill("07:00");
  await expect(page.locator(".times-row").first().locator(".p-error")).toHaveText("잘 준비 시각은 등교 시각보다 늦어야 해요");
  await expect(page.getByRole("button", { name: "저장" })).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/parent-times-error.png` });
  // 다른 자녀를 보고 있어도 저장할 수 없는 이유를 보여 줍니다.
  await page.locator(".p-segment-item", { hasText: "둘째" }).click();
  await expect(page.locator(".p-error")).toHaveText("잘 준비 시각은 등교 시각보다 늦어야 해요");
  await page.locator(".p-segment-item", { hasText: "첫째" }).click();
  await bed.fill("21:00");
  await expect(page.locator(".p-error")).toHaveCount(0);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.locator(".p-notice")).toHaveText("저장했어요");
  await backToMenu(page);

  // 날씨 지역: 고르면 저장하고 보드의 날씨를 바로 다시 가져옵니다.
  await openMenu(page, "날씨 지역");
  await expect(page.locator(".p-current")).toHaveText("아직 정하지 않았어요");
  await page.locator(".p-search input").fill("성남");
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.locator(".place-result")).toHaveText(["서울특별시", "성남시, 경기도"]);
  expect(geocodingCalls).toBe(1);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-location.png` });
  const before = forecastCalls;
  await page.locator(".place-result", { hasText: "성남시" }).click();
  await expect(page.locator(".p-status")).toHaveText("성남시, 경기도(으)로 바꿨어요. 날씨를 새로 가져와요.");
  await expect(page.locator(".p-current")).toHaveText("성남시, 경기도");
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

  // PIN 변경
  await openMenu(page, "PIN 변경");
  await expect(page.locator(".pin-title")).toHaveText("지금 쓰는 PIN을 입력해 주세요");
  await expect(page.getByRole("button", { name: "PIN을 잊었어요" })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/parent-change-pin.png` });
  await typeDigits(page, "1234");
  await expect(page.locator(".pin-title")).toHaveText("새 PIN을 정해 주세요");
  await typeDigits(page, "4321");
  await typeDigits(page, "4321");
  await expect(page.locator(".p-notice")).toHaveText("PIN을 바꿨어요");

  // 복구 코드 새로 만들기
  await openMenu(page, "복구 코드 새로 만들기");
  await page.getByRole("button", { name: "새로 만들기" }).click();
  await expect(page.locator(".recovery-code")).toHaveText(/^[0-9]{4} [0-9]{4}$/);
  await page.getByRole("button", { name: "적어 두었어요" }).click();
  await expect(page.locator(".p-topbar-title")).toHaveText("부모 모드");

  // 지역을 바꾼 날씨가 보드에 보입니다.
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();
  await expect(page.locator(".weather-sub")).toHaveText("성남시");
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
  await setUpPin(page, "1234");
  await expect(page.locator(".p-warning")).toHaveText("백업한 지 10일 지났어요");
  await page.screenshot({ path: `${SHOTS}/parent-home-backup-reminder.png` });
});

test("idle for 2 minutes returns to the board", async ({ page }) => {
  await page.clock.install({ time: new Date(THU_MORNING) });
  await page.goto("./");
  await expect(page.locator(".panel")).toHaveCount(2);
  const box = await page.locator(".settings-button").boundingBox();
  if (!box) throw new Error("no settings button");
  await page.mouse.move(box.x + 22, box.y + 22);
  await page.mouse.down();
  await page.clock.runFor(3100);
  await page.mouse.up();
  await expect(page.locator(".pin-title")).toHaveText("새 PIN을 정해 주세요");
  await typeDigits(page, "1234");
  await typeDigits(page, "1234");
  await page.getByRole("button", { name: "적어 두었어요" }).click();
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
