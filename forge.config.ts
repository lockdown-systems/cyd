import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { spawnSync, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

import archiver from 'archiver';

// Make sure build path exists
const buildPath = path.join(__dirname, 'build');
if (!fs.existsSync(buildPath)) {
  fs.mkdirSync(buildPath);
}
const assetsPath = path.join(__dirname, 'assets');


const config: ForgeConfig = {
  packagerConfig: {
    name: 'Semiphemeral',
    appBundleId: 'systems.lockdown.semiphemeral',
    appCopyright: 'Copyright 2024 Lockdown Systems LLC',
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

      // Build X archive site
      (_buildPath, _electronVersion, _platform, _arch, callback) => {
        const xArchiveSitePath = path.join(__dirname, 'archive-static-sites', 'x-archive');

        // Run `npm install`
        spawnSync('npm', ['install'], {
          cwd: xArchiveSitePath,
          stdio: 'inherit'
        });

        // Run `npm run build`
        spawnSync('npm', ['run', 'build'], {
          cwd: xArchiveSitePath,
          stdio: 'inherit'
        });

        // Delete archive.js if it exists, since we don't want to be shipping test data
        const archiveJsPath = path.join(xArchiveSitePath, 'dist', 'assets', 'archive.js');
        if (fs.existsSync(archiveJsPath)) {
          fs.unlinkSync(archiveJsPath);
        }

        // Zip it up
        const output = fs.createWriteStream(path.join(buildPath, 'x-archive.zip'));
        const archive = archiver('zip');

        output.on('close', function () {
          console.log(archive.pointer() + ' total bytes');
          callback();
        });

        archive.on('warning', function (err: any) {
          if (err.code === 'ENOENT') {
            console.log(err);
          } else {
            // throw error
            throw err;
          }
        });

        archive.on('error', function (err: any) {
          throw err;
        });

        archive.pipe(output);
        archive.directory(path.join(xArchiveSitePath, 'dist'), false);
        archive.finalize();
      },

    ],
    extraResource: [
      path.join(buildPath, 'x-archive.zip'),
      path.join(buildPath, 'config.json'),
      path.join(assetsPath, 'icon.png'),
    ],
    afterComplete: [

      // macOS codesign here because osxSign seems totally broken
      (_buildPath, _electronVersion, _platform, _arch, callback) => {
        if (_platform !== 'darwin') {
          callback();
          return;
        }

        const appPath = path.join(_buildPath, "Semiphemeral.app");
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
            const relativePath = path.relative(appPath, file);
            console.log(`👉 Signing ${relativePath} with ${path.basename(entitlements)}, --options=${options}`);
            execSync(`codesign --force --sign "${identity}" --entitlements "${entitlements}" --timestamp --deep --force --options ${options} "${file}"`);
          } catch (error) {
            console.error(`Error signing ${file}:`, error);
          }
        });

        callback();
      },
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerDMG({
      name: `Install Semiphemeral`,
      background: path.join(assetsPath, 'dmg-background.png'),
      iconSize: 110,
      icon: path.join(assetsPath, 'installer-icon.icns'),
      overwrite: true,
      contents: [
        { "x": 270, "y": 80, "type": "file", "path": `${process.cwd()}/out/Semiphemeral-darwin-${os.arch()}/Semiphemeral.app` },
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
    new MakerRpm({}),
    new MakerDeb({
      options: {
        icon: path.join(assetsPath, 'icon.png'),
      }
    })
  ],
  hooks: {
    // macOS notarize here because osxNotarize is broken without using osxSign
    postMake: async (forgeConfig, makeResults) => {
      if (makeResults[0].platform !== 'darwin') {
        return makeResults;
      }

      const dmgPath = makeResults[0].artifacts[0];
      const appleId = process.env.APPLE_ID ? process.env.APPLE_ID : '';
      const appleIdPassword = process.env.APPLE_PASSWORD ? process.env.APPLE_PASSWORD : '';
      const teamId = "G762K6CH36";

      // Notarize the DMG
      console.log('Notarizing macOS DMG package');
      execSync(`xcrun notarytool submit "${dmgPath}" --wait --apple-id "${appleId}" --password "${appleIdPassword}" --team-id "${teamId}" --progress`);

      // Staple the notarization ticket to the DMG
      console.log('Stapling notarization ticket to macOS DMG package');
      execSync(`xcrun stapler staple "${dmgPath}"`);

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
