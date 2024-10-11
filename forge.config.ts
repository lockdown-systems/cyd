import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { PublisherS3 } from '@electron-forge/publisher-s3';

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Make sure build path exists
const buildPath = path.join(__dirname, 'build');
if (!fs.existsSync(buildPath)) {
  fs.mkdirSync(buildPath);
}
const assetsPath = path.join(__dirname, 'assets');

// Build the X archive site
if (os.platform() == 'win32') {
  const scriptPath = path.join(__dirname, 'archive-static-sites', 'build.ps1');
  execSync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, { stdio: 'inherit' });
} else {
  execSync(path.join(__dirname, 'archive-static-sites', 'build.sh'));
}

// Load the version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

// Find the latest signtool.exe path
function findLatestSigntoolPath(): string {
  if (os.platform() !== 'win32') {
    return '';
  }

  const baseDir = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  const versionPrefix = '10.';

  try {
    // Read the directories in the base directory
    const directories = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && dirent.name.startsWith(versionPrefix))
      .map(dirent => dirent.name);

    if (directories.length === 0) {
      throw new Error('No version directories found');
    }

    // Sort the directories to find the largest version
    directories.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    // Get the largest version directory
    const latestVersionDir = directories[0];

    // Construct the path to signtool.exe
    const signtoolPath = path.join(baseDir, latestVersionDir, 'x64', 'signtool.exe');

    // Check if signtool.exe exists
    if (!fs.existsSync(signtoolPath)) {
      throw new Error(`signtool.exe not found in ${signtoolPath}`);
    }

    return signtoolPath;
  } catch (error) {
    console.error('Error finding signtool.exe:', error);
    return "";
  }
}

const shouldSignWindows = process.env.WINDOWS_SIGN === 'true';

function removeCodeSignatures(dir: string) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file === '_CodeSignature') {
        fs.rmSync(filePath, { recursive: true, force: true });
        console.log(`Removed: ${filePath}`);
      } else {
        removeCodeSignatures(filePath);
      }
    }
  });
}

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Semiphemeral',
    executableName: os.platform() == 'linux' ? 'semiphemeral' : 'Semiphemeral',
    appBundleId: 'systems.lockdown.semiphemeral',
    appCopyright: `Copyright ${new Date().getFullYear()} Lockdown Systems LLC`,
    asar: true,
    icon: path.join(assetsPath, 'icon'),
    beforeAsar: [
      // Copy the config.json file to the resources path
      (_buildPath, _electronVersion, _platform, _arch, callback) => {
        const semiphemeralEnv = process.env.SEMIPHEMERAL_ENV || 'prod';
        const semiphemeralConfigPath = path.join(__dirname, 'config', `${semiphemeralEnv}.json`);
        const semiphemeralConfigDestPath = path.join(buildPath, 'config.json');
        fs.copyFileSync(semiphemeralConfigPath, semiphemeralConfigDestPath);
        callback();
      },
    ],
    extraResource: [
      path.join(buildPath, 'x-archive.zip'),
      path.join(buildPath, 'config.json'),
      path.join(assetsPath, 'icon.png'),
    ],
  },
  rebuildConfig: {},
  makers: [
    // Windows
    new MakerSquirrel({
      iconUrl: "https://raw.githubusercontent.com/Lockdown-Systems/Semiphemeral-Releases/main/icon.ico",
      name: "Semiphemeral",
      setupIcon: path.join(assetsPath, "icon.ico"),
      windowsSign: shouldSignWindows ? {
        signToolPath: findLatestSigntoolPath()
      } : undefined,
      // For auto-updates
      remoteReleases: `https://semiphemeral-releases.sfo3.cdn.digitaloceanspaces.com/${process.env.SEMIPHEMERAL_ENV}/win32/${process.arch}`,
    }),
    // macOS DMG
    new MakerDMG({
      name: `Semiphemeral ${version}`,
      background: path.join(assetsPath, 'dmg-background.png'),
      iconSize: 110,
      icon: path.join(assetsPath, 'installer-icon.icns'),
      overwrite: true,
      contents: [
        { "x": 270, "y": 80, "type": "file", "path": `${process.cwd()}/out/Semiphemeral-darwin-universal/Semiphemeral.app` },
        { "x": 430, "y": 80, "type": "link", "path": "/Applications" }
      ],
      additionalDMGOptions: {
        window: {
          size: {
            width: 540,
            height: 200,
          },
        }
      },
    }),
    // macOS ZIP, for auto-updates
    new MakerZIP({
      macUpdateManifestBaseUrl: `https://semiphemeral-releases.sfo3.cdn.digitaloceanspaces.com/${process.env.SEMIPHEMERAL_ENV}/darwin/universal`
    }),
    // Linux RPM
    new MakerRpm({}),
    // Linux Debian
    new MakerDeb({
      options: {
        icon: path.join(assetsPath, 'icon.png'),
        maintainer: 'Lockdown Systems LLC',
        homepage: 'https://semiphemeral.com',
        categories: ['Utility', 'Network'],
        description: 'Claw back your data from Big Tech',
        productName: "Semiphemeral",
      }
    })
  ],
  publishers: [
    new PublisherS3({
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
      bucket: 'semiphemeral-releases',
      endpoint: 'https://sfo3.digitaloceanspaces.com',
      region: 'sfo3',
      folder: process.env.SEMIPHEMERAL_ENV,
      public: true,
      keyResolver: (filename: string, platform: string, arch: string) => {
        return `${process.env.SEMIPHEMERAL_ENV}/${platform}/${arch}/${filename}`
      }
    })
  ],
  hooks: {
    // Delete pre-existing code signatures from the app bundle, as this prevents the unversal binary from building
    // We will codesign it later
    packageAfterPrune: async (forgeConfig, buildPath, electronVersion, platform, _arch) => {
      if (platform !== 'darwin') {
        return;
      }

      console.log("🍎 Deleting pre-existing code signatures from app bundle");
      const appPath = path.join(buildPath, '..', '..', '..');
      removeCodeSignatures(appPath);
    },

    // macOS codesign here because osxSign seems totally broken
    preMake: async (_forgeConfig) => {
      if (os.platform() !== 'darwin') {
        return;
      }

      console.log('🍎 Preparing to codesign macOS app bundle');

      const universalBuildPath = path.join(__dirname, 'out', 'Semiphemeral-darwin-universal');
      const appPath = path.join(universalBuildPath, "Semiphemeral.app");
      const identity = "Developer ID Application: Lockdown Systems LLC (G762K6CH36)";
      const entitlementDefault = path.join(assetsPath, 'entitlements', 'default.plist');
      const entitlementGpu = path.join(assetsPath, 'entitlements', 'gpu.plist');
      const entitlementPlugin = path.join(assetsPath, 'entitlements', 'plugin.plist');
      const entitlementRenderer = path.join(assetsPath, 'entitlements', 'renderer.plist');

      // Make a list of Mach-O binaries to sign
      const filesToSign: string[] = [];

      const findMachOBinaries = (dir: string) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            findMachOBinaries(filePath);
          } else {
            try {
              const fileType = execSync(`file "${filePath}"`).toString();
              if (fileType.includes('Mach-O')) {
                filesToSign.push(filePath);
              }
            } catch (error) {
              console.error(`Error checking file type for ${filePath}:`, error);
            }
          }
        });
      };

      findMachOBinaries(appPath);

      // Add the app bundle itself to the list
      filesToSign.push(appPath);

      // Code sign each file in filesToSign
      filesToSign.forEach(file => {
        let options = 'runtime';
        if (file.includes('Frameworks') || file.includes('.dylib')) {
          options = 'runtime,library';
        }

        let entitlements = entitlementDefault;
        if (file.includes('(Plugin).app')) {
          entitlements = entitlementPlugin;
        } else if (file.includes('(GPU).app')) {
          entitlements = entitlementGpu;
        } else if (file.includes('(Renderer).app')) {
          entitlements = entitlementRenderer;
        }

        try {
          execSync(`codesign --force --sign "${identity}" --entitlements "${entitlements}" --timestamp --deep --force --options ${options} "${file}"`);
        } catch (error) {
          console.error(`Error signing ${file}:`, error);
        }
      });

      console.log('🍎 Finished codesigning macOS app bundle');
    },

    // macOS notarize here because osxNotarize is broken without using osxSign
    postMake: async (forgeConfig, makeResults) => {
      if (makeResults[0].platform !== 'darwin') {
        return makeResults;
      }

      console.log('🍎 Preparing to notarize macOS artifacts');

      const appleId = process.env.APPLE_ID ? process.env.APPLE_ID : '';
      const appleIdPassword = process.env.APPLE_PASSWORD ? process.env.APPLE_PASSWORD : '';
      const teamId = "G762K6CH36";

      const artifactPaths: string[] = [];
      const submissionIDs: string[] = [];

      for (const result of makeResults) {
        for (const artifactPath of result.artifacts) {
          // Skip artifiacts that are not DMGs or ZIPs
          if (artifactPath.endsWith('.dmg') || artifactPath.endsWith('.zip')) {
            artifactPaths.push(artifactPath);

            // Notarize the artifact
            console.log(`🍎 Submitting macOS artifact: ${artifactPath}`);
            const outputJSON = execSync(`xcrun notarytool submit "${artifactPath}" --apple-id "${appleId}" --password "${appleIdPassword}" --team-id "${teamId}" -f json`);
            const output = JSON.parse(outputJSON.toString());
            submissionIDs.push(output.id);
          } else {
            console.log(`🍎 Skipping notarization for artifact: ${artifactPath}`);
          }
        }
      }

      // Wait for the notarization to complete
      for (let i = 0; i < submissionIDs.length; i++) {
        const submissionID = submissionIDs[i];
        const artifactPath = artifactPaths[i];

        console.log(`🍎 Waiting for notarization of macOS artifact: ${artifactPath}`);
        execSync(`xcrun notarytool wait "${submissionID}" --apple-id "${appleId}" --password "${appleIdPassword}" --team-id "${teamId}"`);

        console.log(`🍎 Finished notarizing macOS artifact: ${artifactPath}`);
      }

      // Staple the notarization ticket to the artifact
      for (const artifactPath of artifactPaths) {
        console.log(`🍎 Stapling notarization ticket to macOS artifact: ${artifactPath}`);
        execSync(`xcrun stapler staple "${artifactPath}`);
      }

      return makeResults;
    },
  },
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'src/renderer/vite.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
