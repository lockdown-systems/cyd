import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import fs from 'fs';
import path from 'path';

function copyDirectory(srcDir: string, destDir: string) {
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'systems.lockdown.semiphemeral',
    appCopyright: 'Copyright 2024 Lockdown Systems LLC',
    beforeAsar: [(buildPath, _electronVersion, _platform, _arch, callback) => {
      // Copy the prisma folders to app.asar
      copyDirectory(
        path.join(__dirname, 'prisma/'),
        path.join(buildPath, 'prisma/')
      );
      copyDirectory(
        path.join(__dirname, 'node_modules/@prisma/'),
        path.join(buildPath, 'node_modules/@prisma/')
      );
      copyDirectory(
        path.join(__dirname, 'node_modules/prisma/'),
        path.join(buildPath, 'node_modules/prisma/')
      );
      copyDirectory(
        path.join(__dirname, 'node_modules/.prisma/'),
        path.join(buildPath, 'node_modules/.prisma/')
      );

      callback();
    }],
    afterComplete: [(buildPath, _electronVersion, _platform, _arch, callback) => {
      copyDirectory(
        path.join(__dirname, 'prisma/'),
        path.join(buildPath, 'resources/prisma/')
      );
      copyDirectory(
        path.join(__dirname, 'node_modules/@prisma/'),
        path.join(buildPath, 'resources/node_modules/@prisma/')
      );
      copyDirectory(
        path.join(__dirname, 'node_modules/prisma/'),
        path.join(buildPath, 'resources/node_modules/prisma/')
      );
      copyDirectory(
        path.join(__dirname, 'node_modules/.prisma/'),
        path.join(buildPath, 'resources/node_modules/.prisma/')
      );

      callback();
    }],
    asar: true,
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
