import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  base: "/kid-board/",
  plugins: [preact()],
  build: { target: "safari15", cssTarget: "safari15" },
});
