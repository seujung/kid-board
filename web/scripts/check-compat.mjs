import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: check-compat.mjs <dir>");
  process.exit(2);
}

const patterns = [
  [/\.at\(/g, ".at("],
  [/structuredClone/g, "structuredClone"],
  [/:has\(/g, ":has("],
  [/dvh/g, "dvh"],
  [/svh/g, "svh"],
  [/backdrop-filter/g, "backdrop-filter"],
];

function* walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if ([".js", ".css"].includes(extname(p))) yield p;
  }
}

let bad = 0;
for (const file of walk(dir)) {
  const text = readFileSync(file, "utf8");
  for (const [re, label] of patterns) {
    for (const m of text.matchAll(re)) {
      const before = text.slice(0, m.index);
      const line = before.split("\n").length;
      const col = m.index - before.lastIndexOf("\n");
      console.error(`${file}:${line}:${col} uses ${label}`);
      bad++;
    }
  }
}
if (bad > 0) process.exit(1);
console.log("compat ok");
