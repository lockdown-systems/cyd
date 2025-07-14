import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
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
