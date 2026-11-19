import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { defineConfig, transformWithOxc } from "vite";
import type { Plugin } from "vite";
import preact from "@preact/preset-vite";
import { appVersion } from "./scripts/appVersion";

const BASE = "/kid-board/";

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listFiles(path));
    else out.push(path);
  }
  return out;
}

/**
 * src/sw.ts를 dist/sw.js(해시 없는 고정 이름)로 빌드합니다.
 * 빌드가 끝난 dist의 파일 전체(해시 붙은 자산, index.html, 매니페스트, 아이콘)와 범위 주소 "/kid-board/"를
 * 미리 받을 목록으로 넣고, 목록과 파일 내용의 해시로 캐시 이름을 정합니다. 배포마다 새 워커가 됩니다.
 */
function serviceWorker(): Plugin {
  let outDir = "dist";
  let root = process.cwd();
  return {
    name: "kid-board-service-worker",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = join(config.root, config.build.outDir);
    },
    async closeBundle() {
      const files = listFiles(outDir)
        .map((path) => relative(outDir, path).split(sep).join("/"))
        .filter((name) => name !== "sw.js" && !name.endsWith(".map") && !name.startsWith("."))
        .sort();
      const hash = createHash("sha256");
      for (const name of files) {
        hash.update(name);
        hash.update(readFileSync(join(outDir, name)));
      }
      const precache = [BASE, ...files.map((name) => BASE + name)];
      const cacheName = `kid-board-${hash.digest("hex").slice(0, 12)}`;
      const source = readFileSync(join(root, "src/sw.ts"), "utf8");
      const result = await transformWithOxc(source, "sw.ts", { target: "safari15" });
      const code = result.code
        .replace(/__PRECACHE__/g, JSON.stringify(precache))
        .replace(/__CACHE_NAME__/g, JSON.stringify(cacheName));
      if (/^\s*(import|export)\s/m.test(code)) throw new Error("sw.js must be a classic script (no import/export)");
      writeFileSync(join(outDir, "sw.js"), code);
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [preact(), serviceWorker()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  build: { target: "safari15", cssTarget: "safari15" },
});
