import { defineConfig, devices } from "@playwright/test";

/** 개발 서버입니다. 화면 확인 테스트가 `?fixedNow=`로 시각을 고정합니다. */
const PORT = 5181;
/** 운영 빌드 미리 보기입니다. 서비스 워커는 운영 빌드에서만 등록하므로 오프라인·새 버전 테스트만 씁니다. */
const PREVIEW_PORT = 4173;
const PREVIEW_SPECS = ["offline.spec.ts", "update.spec.ts"];

export default defineConfig({
  testDir: "test/ui",
  testMatch: "*.spec.ts",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Safari"],
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
    timezoneId: "Asia/Seoul",
    locale: "ko-KR",
  },
  projects: [
    {
      name: "webkit",
      testIgnore: PREVIEW_SPECS,
      use: { browserName: "webkit", baseURL: `http://localhost:${PORT}/kid-board/` },
    },
    {
      name: "preview",
      testMatch: PREVIEW_SPECS,
      use: { browserName: "webkit", baseURL: `http://localhost:${PREVIEW_PORT}/kid-board/` },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/kid-board/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}/kid-board/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
