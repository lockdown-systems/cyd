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
  // Ensure TypeScript checking is enabled with same strictness as VS Code
  esbuild: {
    target: "ES2020",
  },
  test: {
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.test.json", // Use unified test TypeScript config
    },
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
