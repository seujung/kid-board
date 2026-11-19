import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { open, panel } from "./support";

/**
 * AudioContext를 가짜로 바꿔 어떤 소리를 요청했는지 기록합니다.
 * 오실레이터가 시작할 때의 주파수와, 스피커(destination)에 연결한 master 게인 값을 남깁니다.
 * 1318.51Hz는 "띵"에만, 392Hz는 빵빠레에만 한 번 들어 있습니다(test/ui/sound.test.ts가 확인합니다).
 */
async function stubAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log = { tones: [] as number[], masters: [] as number[], contexts: 0, resumes: 0, unlocks: 0 };
    (window as unknown as { __audio: typeof log }).__audio = log;
    class Param {
      value = 0;
      setValueAtTime() {}
      linearRampToValueAtTime() {}
      exponentialRampToValueAtTime() {}
    }
    class Node {
      constructor(protected ctx: FakeContext) {}
      connect(dest: unknown) {
        if (dest === this.ctx.destination && this instanceof Gain) log.masters.push(this.gain.value);
      }
    }
    class Gain extends Node {
      gain = new Param();
    }
    class Osc extends Node {
      type = "sine";
      frequency = new Param();
      start() {
        log.tones.push(this.frequency.value);
      }
      stop() {}
    }
    class Source extends Node {
      buffer: unknown = null;
      start() {
        log.unlocks++;
      }
    }
    class FakeContext {
      state = "suspended";
      currentTime = 0;
      sampleRate = 44100;
      destination = {};
      constructor() {
        log.contexts++;
      }
      resume() {
        log.resumes++;
        this.state = "running";
        return Promise.resolve();
      }
      createGain() {
        return new Gain(this);
      }
      createOscillator() {
        return new Osc(this);
      }
      createBuffer() {
        return {};
      }
      createBufferSource() {
        return new Source(this);
      }
    }
    const w = window as unknown as Record<string, unknown>;
    w.AudioContext = FakeContext;
    w.webkitAudioContext = FakeContext;
  });
}

const CHIME_HZ = 1318.51;
const FANFARE_HZ = 392;

async function requested(page: Page): Promise<{ chime: number; fanfare: number }> {
  const tones = await page.evaluate(() => (window as unknown as { __audio: { tones: number[] } }).__audio.tones);
  return {
    chime: tones.filter((f) => f === CHIME_HZ).length,
    fanfare: tones.filter((f) => f === FANFARE_HZ).length,
  };
}

async function masters(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as { __audio: { masters: number[] } }).__audio.masters);
}

test("completing chimes, the last task plays a fanfare, undo is silent", async ({ page }) => {
  await stubAudio(page);
  await open(page, "2026-11-19T07:42:00+09:00");
  const cards = panel(page, 0).locator(".task-card");
  await expect(cards).toHaveCount(5);
  expect(await requested(page)).toEqual({ chime: 0, fanfare: 0 });

  await cards.nth(0).click();
  await expect(panel(page, 0).locator(".stamp")).toHaveCount(1);
  expect(await requested(page)).toEqual({ chime: 1, fanfare: 0 });
  // 첫 터치에서 AudioContext를 만들고 깨우며, 무음 버퍼로 소리 잠금을 풉니다.
  const unlock = await page.evaluate(() => (window as unknown as { __audio: { contexts: number; resumes: number; unlocks: number } }).__audio);
  expect(unlock.contexts).toBe(1);
  expect(unlock.resumes).toBeGreaterThanOrEqual(1);
  expect(unlock.unlocks).toBe(1);
  // 기본 볼륨은 "보통"(0.5)입니다.
  expect(await masters(page)).toEqual([0.5]);

  // 취소는 소리가 없습니다.
  await cards.nth(0).click();
  await expect(panel(page, 0).locator(".dialog-title")).toHaveText("취소할까요?");
  await panel(page, 0).locator(".dialog-yes").click();
  await expect(panel(page, 0).locator(".stamp")).toHaveCount(0);
  expect(await requested(page)).toEqual({ chime: 1, fanfare: 0 });

  for (const n of [0, 1, 2, 3]) await cards.nth(n).click();
  await expect(panel(page, 0).locator(".stamp")).toHaveCount(4);
  expect(await requested(page)).toEqual({ chime: 5, fanfare: 0 });

  // 마지막 할 일은 "띵" 대신 빵빠레입니다.
  await cards.nth(4).click();
  await expect(panel(page, 0).locator(".celebration")).toBeVisible();
  expect(await requested(page)).toEqual({ chime: 5, fanfare: 1 });
});

test("a tap that only shakes a card is silent", async ({ page }) => {
  await stubAudio(page);
  // 잘 준비 시각(21:30)이 지났지만 화면 끄기 시간(22:00) 전입니다.
  await open(page, "2026-11-19T21:45:00+09:00");
  await expect(page.locator(".night-overlay")).toHaveCount(0);
  const card = panel(page, 0).locator(".task-card").nth(0);
  await card.click();
  await expect(card).toHaveClass(/shake/);
  await expect(panel(page, 0).locator(".stamp")).toHaveCount(0);
  expect(await requested(page)).toEqual({ chime: 0, fanfare: 0 });
});

async function openSoundSettings(page: Page): Promise<void> {
  const box = await page.locator(".settings-button").boundingBox();
  if (!box) throw new Error("no settings button");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  const digits = async () => {
    for (const d of "1234") await page.locator(".pin-pad").getByRole("button", { name: d, exact: true }).click();
  };
  await digits();
  await digits();
  await page.getByRole("button", { name: "적어 두었어요" }).click();
  await page.locator(".p-menu-item", { hasText: "소리" }).click();
  await expect(page.locator(".p-topbar-title")).toHaveText("소리");
}

test("previews play at the chosen volume and turning sound off silences the board", async ({ page }) => {
  await stubAudio(page);
  await open(page, "2026-11-19T07:42:00+09:00");
  await openSoundSettings(page);
  const toggle = page.getByRole("switch", { name: "소리 켜기" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".p-segment-item.on")).toHaveText("보통");

  await page.getByRole("button", { name: "띵 들어 보기" }).click();
  expect(await requested(page)).toEqual({ chime: 1, fanfare: 0 });
  await page.locator(".p-segment-item", { hasText: "크게" }).click();
  await expect(page.locator(".p-segment-item.on")).toHaveText("크게");
  await page.getByRole("button", { name: "빵빠레 들어 보기" }).click();
  expect(await requested(page)).toEqual({ chime: 1, fanfare: 1 });
  await page.locator(".p-segment-item", { hasText: "작게" }).click();
  await page.getByRole("button", { name: "띵 들어 보기" }).click();
  expect(await masters(page)).toEqual([0.5, 0.9, 0.25]);

  // 끄면 바로 저장하고, 보드에서 할 일을 끝내도 소리가 없습니다.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".p-notice")).toHaveText("저장했어요");
  await page.getByRole("button", { name: "보드로 돌아가기" }).click();
  const before = await requested(page);
  const cards = panel(page, 0).locator(".task-card");
  for (const n of [0, 1, 2, 3, 4]) await cards.nth(n).click();
  await expect(panel(page, 0).locator(".celebration")).toBeVisible();
  expect(await requested(page)).toEqual(before);

  // 다시 열어도 꺼져 있고 볼륨은 "작게"입니다.
  await page.reload();
  await expect(page.locator(".panel")).toHaveCount(2);
  const box = await page.locator(".settings-button").boundingBox();
  if (!box) throw new Error("no settings button");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  for (const d of "1234") await page.locator(".pin-pad").getByRole("button", { name: d, exact: true }).click();
  await page.locator(".p-menu-item", { hasText: "소리" }).click();
  await expect(page.getByRole("switch", { name: "소리 켜기" })).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".p-segment-item.on")).toHaveText("작게");
});
