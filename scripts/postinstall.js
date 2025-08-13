#!/usr/bin/env node

const { execSync } = require("child_process");

// Skip rebuild in CI environments
if (process.env.CI === "true" || process.env.CI === "1") {
  console.log("Skipping electron-rebuild in CI environment");
  process.exit(0);
}

// Rebuild native modules for Electron
console.log("Rebuilding native modules for Electron...");
console.log("- Searching dependency tree");
try {
  execSync("pnpm exec electron-rebuild --force", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  console.log("✅ Native modules rebuilt successfully");
} catch (error) {
  console.error("❌ Failed to rebuild native modules:", error.message);
  process.exit(1);
}
