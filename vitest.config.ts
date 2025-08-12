import { defineConfig } from "vitest/config";
import { resolve } from "path";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "/assets": resolve(__dirname, "src/renderer/public/assets"),
    },
  },
  esbuild: {
    target: "ES2020",
  },
  test: {
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.test.json",
    },
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    root: "./",
    setupFiles: ["src/renderer/src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,ts,vue}"],
      all: true,
      perFile: true,
      clean: true,
      skipFull: false,
      reportOnFailure: true,
      exclude: [
        "coverage/**",
        "dist/**",
        ".vite/**",
        "node_modules/**",
        "*.ts",
        "**/*.d.ts",
        "archive-static-sites/**",
        "docs/**",
        "scripts/**",
        "build/**",
        "assets/**",
        "testdata/**",
        "forge.config.ts",
        "vite.*.config.ts",
        "eslint.config.mjs",
        "**/*.{test,spec}.{js,ts,tsx,vue}",
        "**/test-setup.ts",
        "**/test_util.ts",
      ],
    },
  },
});
