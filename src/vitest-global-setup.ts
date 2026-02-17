// Force the Electron process to exit after vitest finishes.
// Native modules (better-sqlite3) and Electron internals keep handles
// open that prevent the Vite server from shutting down gracefully.
export function teardown() {
  setTimeout(() => {
    process.exit(0);
  }, 3000).unref();
}
