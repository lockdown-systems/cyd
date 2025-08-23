/* global console */
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

// Delete output from last release
const fullPath = path.resolve("./out");
if (fs.existsSync(fullPath)) {
  console.log(`Deleting: ${fullPath}`);
  fs.rmSync(fullPath, { recursive: true, force: true });
}

// Delete all files in the build directory except config.json
const buildDir = path.resolve("./build");
if (fs.existsSync(buildDir)) {
  console.log(`Cleaning: ${buildDir}`);
  fs.readdirSync(buildDir).forEach((file) => {
    const filePath = path.join(buildDir, file);
    if (file !== "config.json") {
      console.log(`Deleting: ${filePath}`);
      fs.rmSync(filePath, { recursive: true, force: true });
    }
  });
}

console.log("Running npm install for Cyd...");
execSync("npm install", { stdio: "inherit" });

console.log("Running npm install for docs...");
execSync("npm install", { stdio: "inherit", cwd: "docs" });

console.log("Running npm install for x-archive...");
execSync("npm install", {
  stdio: "inherit",
  cwd: "archive-static-sites/x-archive",
});

console.log("Running npm install for facebook-archive...");
execSync("npm install", {
  stdio: "inherit",
  cwd: "archive-static-sites/facebook-archive",
});

if (os.platform() === "linux") {
  const chromeSandboxPath = path.resolve(
    "node_modules/electron/dist/chrome-sandbox",
  );
  if (fs.existsSync(chromeSandboxPath)) {
    console.log("Adjusting permissions for chrome-sandbox...");
    execSync(`sudo chown root:root ${chromeSandboxPath}`);
    execSync(`sudo chmod 4755 ${chromeSandboxPath}`);
  }
}
