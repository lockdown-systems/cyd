import { join } from "node:path";
import { builtinModules } from "node:module";
import type { ConfigEnv, UserConfig } from "vite";
import { defineConfig } from "vite";
import { pluginExposeRenderer } from "../../vite.base.config";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<"renderer">;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = "main_window";

  return {
    root: __dirname,
    mode,
    base: "./",
    build: {
      outDir: `../../.vite/renderer/${name}`,
      rollupOptions: {
        input: [join(__dirname, "src/main.ts"), join(__dirname, "index.html")],
        external: [...builtinModules.flatMap((p) => [p, `node:${p}`])],
      },
    },
    plugins: [
      pluginExposeRenderer(name),
      vue({
        template: {
          compilerOptions: {
            // Treat <webview> tag as a custom element
            isCustomElement: (tag) => tag.includes("webview"),
          },
        },
      }),
    ],
    resolve: {
      preserveSymlinks: true,
    },
    clearScreen: false,
  } as UserConfig;
});
