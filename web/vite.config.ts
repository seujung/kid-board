import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/** 부모 모드에 표시하는 버전입니다. 예: "0.0.0 (2026-11-19 20:55)" (빌드한 Mac의 시각) */
function appVersion(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pkg.version} (${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())})`;
}

export default defineConfig({
  base: "/kid-board/",
  plugins: [preact()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  build: { target: "safari15", cssTarget: "safari15" },
});
