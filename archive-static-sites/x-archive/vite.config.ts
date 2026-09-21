import { fileURLToPath, URL } from "node:url";

import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";

// Browsers refuse to fetch an ES module over file://, and an archive is read by
// double-clicking index.html. The bundle is emitted as a single iife, but Vite
// still tags the entry as a module, so strip the attributes back off. It needs
// defer to keep the module's timing: the tag sits in head, and a bare classic
// script would run before #app is parsed and mount onto nothing.
const classicEntryScript = (): Plugin => ({
  name: "x-archive-classic-entry-script",
  enforce: "post",
  transformIndexHtml: (html) =>
    html
      .replace(/<script type="module" crossorigin src=/g, "<script defer src=")
      .replace(/ crossorigin(?=[ />])/g, ""),
});

// Every URL has to be relative, and the router runs on hash history. Filenames
// keep the assets/js and assets/css layout so a new zip can be unpacked over an
// existing archive folder.
export default defineConfig({
  base: "./",
  plugins: [vue(), classicEntryScript()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    assetsDir: "assets",
    modulePreload: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        format: "iife",
        entryFileNames: "assets/js/[name].[hash].js",
        assetFileNames: ({ names }) =>
          names?.some((name) => name.endsWith(".css"))
            ? "assets/css/[name].[hash][extname]"
            : "assets/[name].[hash][extname]",
      },
    },
  },
});
