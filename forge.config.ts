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

// For cyd:// and cyd-dev:// URLs
const protocols = [];
if (process.env.CYD_ENV == 'prod') {
  protocols.push({
    "name": "Cyd",
    "schemes": ["cyd"]
  });
} else {
  protocols.push({
    "name": "Cyd Dev",
    "schemes": ["cyd-dev"]
  });
}
const mimeTypeScheme = process.env.CYD_ENV == 'prod' ? 'x-scheme-handler/cyd' : 'x-scheme-handler/cyd-dev';

const config: ForgeConfig = {
  packagerConfig: {
    name: process.env.CYD_ENV == 'prod' ? 'Cyd' : 'Cyd Dev',
    executableName: os.platform() == 'linux' ? (process.env.CYD_ENV == 'prod' ? 'cyd' : 'cyd-dev') : (process.env.CYD_ENV == 'prod' ? 'Cyd' : 'Cyd Dev'),
    appBundleId: process.env.CYD_ENV == 'prod' ? 'systems.lockdown.cyd' : 'systems.lockdown.cyd-dev',
    appCopyright: `Copyright ${new Date().getFullYear()} Lockdown Systems LLC`,
    asar: true,
    icon: path.join(assetsPath, 'icon'),
    beforeAsar: [
      // Copy the config.json file to the resources path
      (_buildPath, _electronVersion, _platform, _arch, callback) => {
        const cydEnv = process.env.CYD_ENV || 'prod';
        const cydConfigPath = path.join(__dirname, 'config', `${cydEnv}.json`);
        const cydConfigDestPath = path.join(buildPath, 'config.json');
        fs.copyFileSync(cydConfigPath, cydConfigDestPath);
        callback();
      },
    ],
    extraResource: [
      path.join(buildPath, 'x-archive.zip'),
      path.join(buildPath, 'facebook-archive.zip'),
      path.join(buildPath, 'config.json'),
      path.join(assetsPath, 'icon.png'),
    ],
    protocols: protocols,
  },
  rebuildConfig: {},
  makers: [
    // Windows
    new MakerSquirrel({
      iconUrl: "https://releases.lockdown.systems/cyd/icon.ico",
      name: process.env.CYD_ENV == 'prod' ? "Cyd" : "CydDev",
      setupIcon: path.join(assetsPath, "installer-icon.ico"),
      loadingGif: path.join(assetsPath, "installer-loading.gif"),
      windowsSign: process.env.WINDOWS_RELEASE === 'true' ? {
        signToolPath: findLatestSigntoolPath()
      } : undefined,
      // For auto-updates
      remoteReleases: `https://releases.lockdown.systems/cyd/${process.env.CYD_ENV}/windows/${process.arch}`,
      noDelta: process.env.WINDOWS_RELEASE === 'true' ? false : true,
    }),
    // macOS DMG
    new MakerDMG({
      name: process.env.CYD_ENV == 'prod' ? `Cyd ${version}` : `Cyd Dev ${version}`,
      background: path.join(assetsPath, 'dmg-background.png'),
      icon: path.join(assetsPath, 'installer-icon.icns'),
      iconSize: 110,
      overwrite: true,
      contents: [
        { "x": 270, "y": 142, "type": "file", "path": process.env.CYD_ENV == 'prod' ? `${process.cwd()}/out/Cyd-darwin-universal/Cyd.app` : `${process.cwd()}/out/Cyd Dev-darwin-universal/Cyd Dev.app` },
        { "x": 428, "y": 142, "type": "link", "path": "/Applications" }
      ],
      additionalDMGOptions: {
        window: {
          size: {
            width: 540,
            height: 290,
          },
        }
      },
    }),
    // macOS ZIP, for auto-updates
    new MakerZIP({
      macUpdateManifestBaseUrl: `https://releases.lockdown.systems/cyd/${process.env.CYD_ENV}/macos/universal`
    }),
    // Linux RPM
    new MakerRpm({
      // @ts-expect-error I think the typescript definitions are wrong, but this should work
      icon: path.join(assetsPath, 'icon.png'),
      homepage: 'https://cyd.social',
      categories: ['Utility', 'Network'],
      description: 'Claw back your data from Big Tech',
      productName: process.env.CYD_ENV == 'prod' ? "Cyd" : "Cyd Dev",
      bin: process.env.CYD_ENV == 'prod' ? "cyd" : "cyd-dev",
      name: process.env.CYD_ENV == 'prod' ? "cyd" : "cyd-dev",
      mimeType: [mimeTypeScheme],
    }),
    // Linux Debian
    new MakerDeb({
      options: {
        icon: path.join(assetsPath, 'icon.png'),
        maintainer: 'Lockdown Systems LLC',
        homepage: 'https://cyd.social',
        categories: ['Utility', 'Network'],
        description: 'Claw back your data from Big Tech',
        productName: process.env.CYD_ENV == 'prod' ? "Cyd" : "Cyd Dev",
        bin: process.env.CYD_ENV == 'prod' ? "cyd" : "cyd-dev",
        name: process.env.CYD_ENV == 'prod' ? "cyd" : "cyd-dev",
        mimeType: [mimeTypeScheme],
      }
    })
  ],
  publishers: [
    new PublisherS3({
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
      bucket: 'lockdownsystems-releases',
      endpoint: 'https://sfo3.digitaloceanspaces.com',
      region: 'sfo3',
      folder: process.env.CYD_ENV,
      public: true,
      keyResolver: (filename: string, platform: string, arch: string) => {
        if (platform == 'win32') {
          platform = 'windows';
        }
        if (platform == 'darwin') {
          platform = 'macos';
        }
        return `cyd/${process.env.CYD_ENV}/${platform}/${arch}/${filename}`
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
      if (os.platform() !== 'darwin' || process.env.MACOS_RELEASE !== 'true') {
        return;
      }

      console.log('🍎 Preparing to codesign macOS app bundle');

      const universalBuildPath = path.join(__dirname, 'out', process.env.CYD_ENV == 'prod' ? 'Cyd-darwin-universal' : 'Cyd Dev-darwin-universal');
      const appPath = path.join(universalBuildPath, process.env.CYD_ENV == 'prod' ? "Cyd.app" : "Cyd Dev.app");
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
      if (makeResults[0].platform !== 'darwin' || process.env.MACOS_RELEASE !== 'true') {
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
      }

      // Staple the notarization ticket to the artifact
      for (const artifactPath of artifactPaths) {
        if (artifactPath.endsWith('.dmg')) {
          console.log(`🍎 Stapling notarization ticket to macOS artifact: ${artifactPath}`);
          execSync(`xcrun stapler staple "${artifactPath}"`);
        } else {
          console.log(`🍎 Skipping stapling for artifact: ${artifactPath}`);
        }
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
