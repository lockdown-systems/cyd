/* global console */
import process from "process";
import os from "os";
import { execSync } from "child_process";

// Validate input

const validCommands = ["make", "publish"];
const command = process.argv[2];
if (!validCommands.includes(command)) {
  console.error(
    `Invalid command: "${command}". Valid commands are: ${validCommands.join(", ")}`,
  );
  process.exit(1);
}

const validModes = ["local", "dev", "prod"];
const mode = process.argv[3];
if (!validModes.includes(mode)) {
  console.error(
    `Invalid mode: "${mode}". Valid modes are: ${validModes.join(", ")}`,
  );
  process.exit(1);
}

// Set environment variables

process.env.CYD_ENV = mode;
process.env.DEBUG =
  "electron-packager,electron-universal,electron-forge*,electron-installer*";

const platform = os.platform();
if (platform == "win32") {
  process.env.WINDOWS_RELEASE = command === "publish" ? "true" : "false";
  process.env.SQUIRREL_TEMP = "build\\SquirrelTemp";
} else if (platform == "darwin") {
  process.env.MACOS_RELEASE = command === "publish" ? "true" : "false";
}

try {
  // Clean up previous builds and install dependencies
  execSync(`node ./scripts/clean.mjs`, { stdio: "inherit" });

  // Rebuild macos-alias specifically for Node.js (needed for DMG creation)
  if (platform === "darwin") {
    console.log("Rebuilding macos-alias for Node.js...");
    execSync(`cd node_modules/macos-alias && rm -rf build && node-gyp rebuild`, { stdio: "inherit" });
  }

  // Build
  if (platform == "darwin") {
    execSync(`electron-forge ${command} --arch universal`, {
      stdio: "inherit",
    });
  } else {
    execSync(`electron-forge ${command}`, { stdio: "inherit" });
  }
} catch (error) {
  console.error("Error executing commands:", error.message);
  process.exit(1);
}
