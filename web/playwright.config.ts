import { defineConfig, devices } from "@playwright/test";

const PORT = 5181;

export default defineConfig({
  testDir: "test/ui",
  testMatch: "*.spec.ts",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Safari"],
    baseURL: `http://localhost:${PORT}/kid-board/`,
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
    timezoneId: "Asia/Seoul",
    locale: "ko-KR",
  },
  projects: [{ name: "webkit", use: { browserName: "webkit" } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/kid-board/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
