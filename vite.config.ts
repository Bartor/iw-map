import { defineConfig } from "vite";

// Served from https://bartor.github.io/iw-map/ on GitHub Pages; "/" for local dev.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/iw-map/" : "/",
}));
