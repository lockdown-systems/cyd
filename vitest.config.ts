import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    setupFiles: ["src/renderer/src/test-setup.ts"],
    coverage: {
      provider: "v8",
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
      ],
    },
  },
});
