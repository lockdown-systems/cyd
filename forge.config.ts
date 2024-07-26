import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'path';

import { downloadChromium, downloadSingleFileCLI } from './scripts/download-deps';

const extraResource: string[] = [];

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'systems.lockdown.semiphemeral',
    appCopyright: 'Copyright 2024 Lockdown Systems LLC',
    asar: true,
    icon: "assets/icon",
    beforeCopyExtraResources: [
      async (buildPath, _electronVersion, platform, _arch, callback) => {
        // For macOS, download both the Intel and ARM versions
        if (platform === 'darwin') {
          await downloadChromium("mac-arm64", "./build");
          await downloadChromium("mac-intel", "./build");
          await downloadSingleFileCLI("mac-arm64", "./build");
          await downloadSingleFileCLI("mac-intel", "./build");
          extraResource.push(path.join("./build", "chromium-mac-arm64.zip"));
          extraResource.push(path.join("./build", "chromium-mac-intel.zip"));
          extraResource.push(path.join("./build", "single-file-aarch64-apple-darwin"));
          extraResource.push(path.join("./build", "single-file-x86_64-apple-darwin"));
        }
        // We only have x64 builds for Windows and Linux
        else {
          let platformName: string;
          if (platform === 'win32') {
            platformName = 'win-x64';
            extraResource.push(path.join("./build", "chromium-win-x64.zip"));
            extraResource.push(path.join("./build", "single-file.exe"));
          } else if (platform === 'linux') {
            platformName = 'linux-x64';
            extraResource.push(path.join("./build", "chromium-linux-x64.zip"));
            extraResource.push(path.join("./build", "single-file-x86_64-linux"));
          } else {
            throw new Error(`Unsupported platform: ${platform}`);
          }
          await downloadChromium(platformName, "./build");
          await downloadSingleFileCLI(platformName, "./build");
        }
        callback();
      }
    ],
    extraResource: extraResource,
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({})
  ],
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
