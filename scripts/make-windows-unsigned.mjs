/* global console */
import process from "process";
import { execSync } from "child_process";

const validModes = ["dev", "prod"];
const mode = process.argv[2];
if (!validModes.includes(mode)) {
  console.error(
    `Invalid mode: "${mode}". Valid modes are: ${validModes.join(", ")}`,
  );
  process.exit(1);
}

const arch = process.argv.slice(3).find((value) => !value.startsWith("--"));

process.env.CYD_ENV = mode;
process.env.WINDOWS_RELEASE = "false";
process.env.SQUIRREL_TEMP = "build\\SquirrelTemp";
process.env.DEBUG =
  "electron-packager,electron-universal,electron-forge*,electron-installer*";

try {
  // Keep parity with existing release flow until CI-only build path is introduced.
  execSync("node ./scripts/clean.mjs", { stdio: "inherit" });

  const archFlag = arch ? ` --arch ${arch}` : "";
  execSync(
    `electron-forge make --platform win32 --targets @electron-forge/maker-squirrel${archFlag}`,
    { stdio: "inherit" },
  );
} catch (error) {
  console.error("Error executing unsigned Windows build:", error.message);
  process.exit(1);
}
