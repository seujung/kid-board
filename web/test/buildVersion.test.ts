import { afterEach, expect, test } from "vitest";
import { appVersion } from "../scripts/appVersion";

const original = process.env.TZ;
afterEach(() => {
  process.env.TZ = original;
});

test("appVersionUsesSeoulTimeOnUtcMachine", () => {
  // GitHub Actions 러너는 UTC입니다. 2026-11-18 22:30 UTC는 서울 2026-11-19 07:30입니다.
  process.env.TZ = "UTC";
  expect(appVersion(new Date("2026-11-18T22:30:00Z"))).toBe("20261119-0730");
  process.env.TZ = "America/Los_Angeles";
  expect(appVersion(new Date("2026-12-31T15:05:00Z"))).toBe("20270101-0005");
});
