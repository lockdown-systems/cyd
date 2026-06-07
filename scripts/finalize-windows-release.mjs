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

const args = process.argv.slice(3);
const arch = args.find((value) => !value.startsWith("--"));
const skipClean = args.includes("--skip-clean");

process.env.CYD_ENV = mode;
process.env.WINDOWS_RELEASE = "true";
process.env.SQUIRREL_TEMP = "build\\SquirrelTemp";
process.env.DEBUG =
  "electron-packager,electron-universal,electron-forge*,electron-installer*";

try {
  if (!skipClean) {
    execSync("node ./scripts/clean.mjs", { stdio: "inherit" });
  }

  const archFlag = arch ? ` --arch ${arch}` : "";
  execSync(`electron-forge publish${archFlag}`, { stdio: "inherit" });
} catch (error) {
  console.error("Error executing Windows finalization:", error.message);
  process.exit(1);
}
