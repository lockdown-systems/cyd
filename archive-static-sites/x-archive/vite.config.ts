import { fileURLToPath, URL } from "node:url";

import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";

// Everything file:// needs, in one place.
//
// Browsers refuse to fetch an ES module over file://, and an archive is read by
// double-clicking index.html. The bundle is emitted as a single iife, but Vite
// still tags the entry as a module, so strip the attributes back off. It needs
// defer to keep the module's timing: the tag sits in head, and a bare classic
// script would run before #app is parsed and mount onto nothing. crossorigin
// forces CORS mode, which fails over file:// for the stylesheet too.
//
// archive.js is written into the archive folder by Cyd, long after this build.
// Injecting the tag here rather than leaving it in index.html keeps Vite from
// trying to resolve a file that is not there yet. It stays undeferred so it
// still sets window.archiveData before the entry runs.
const fileProtocolHtml = (): Plugin => ({
  name: "x-archive-file-protocol-html",
  enforce: "post",
  transformIndexHtml: (html) =>
    html
      .replace(/<script type="module" crossorigin src=/g, "<script defer src=")
      .replace(/ crossorigin(?=[ />])/g, "")
      .replace(
        /(\s*)(<script defer src=)/,
        '$1<script src="assets/archive.js"></script>$1$2',
      ),
});

// Every URL has to be relative, and the router runs on hash history. Filenames
// keep the assets/js and assets/css layout so a new zip can be unpacked over an
// existing archive folder.
export default defineConfig({
  base: "./",
  plugins: [vue(), fileProtocolHtml()],
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
