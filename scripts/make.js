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

// The Developer ID identity used to sign macOS releases. forge.config.ts reads
// this from the environment so the preflight check below and the actual signing
// can never drift apart.
const macosSigningIdentity =
  "Developer ID Application: Lockdown Systems LLC (G762K6CH36)";
process.env.MACOS_SIGNING_IDENTITY = macosSigningIdentity;

// Preflight checks
//
// @electron/packager defaults to `continueOnError: true` when signing, so a
// missing identity does not fail the build. It leaves the stock ad-hoc Electron
// signature in place and the build dies minutes later inside notarization with
// "code object is not signed at all", which does not name the real cause. Fail
// up front instead.

function fail(message, hint) {
  console.error(`\n❌ ${message}\n`);
  console.error(`   ${hint}\n`);
  process.exit(1);
}

function requireEnv(name, hint) {
  if (!process.env[name]) {
    fail(`${name} is not set, which ${command} requires.`, hint);
  }
}

if (command === "publish") {
  requireEnv(
    "DO_SPACES_KEY",
    "Needed to upload the release to DigitalOcean Spaces.",
  );
  requireEnv(
    "DO_SPACES_SECRET",
    "Needed to upload the release to DigitalOcean Spaces.",
  );

  if (platform === "darwin") {
    let identities = "";
    try {
      identities = execSync("security find-identity -v -p codesigning", {
        encoding: "utf8",
      });
    } catch {
      fail(
        "Could not read code signing identities from the keychain.",
        "Try running: security find-identity -v -p codesigning",
      );
    }

    if (!identities.includes(macosSigningIdentity)) {
      fail(
        `No code signing identity matching "${macosSigningIdentity}" in your keychain.`,
        "Import the Developer ID .p12, or create a new certificate at " +
          "https://developer.apple.com/account/resources/certificates (Account " +
          "Holder only), then confirm with: security find-identity -v -p codesigning",
      );
    }

    console.log(`✅ Signing identity found: ${macosSigningIdentity}`);

    requireEnv(
      "APPLE_ID",
      "The Apple ID used to notarize. Needed by notarytool.",
    );
    requireEnv(
      "APPLE_PASSWORD",
      "An app-specific password from https://appleid.apple.com, not your Apple ID password.",
    );
  }
}

try {
  // Clean up previous builds and install dependencies
  execSync(`node ./scripts/clean.mjs`, { stdio: "inherit" });

  // Rebuild macos-alias specifically for Node.js (needed for DMG creation)
  if (platform === "darwin") {
    console.log("Rebuilding macos-alias for Node.js...");
    execSync(
      `cd node_modules/macos-alias && rm -rf build && node-gyp rebuild`,
      { stdio: "inherit" },
    );
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
