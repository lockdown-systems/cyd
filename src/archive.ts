import os from 'os';
import path from 'path';
import { existsSync } from 'fs';

import { ipcMain } from 'electron';
import extract from 'extract-zip';

import { getResourcesPath, getChromiumAppPath } from './helpers';

export const defineIPCArchive = () => {
    ipcMain.handle('archive:isChromiumExtracted', async (_): Promise<boolean> => {
        const platform = os.platform();
        const chromiumAppPath = getChromiumAppPath();

        let binPath;
        switch (platform) {
            case 'darwin':
                binPath = path.join(chromiumAppPath, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
                break;
            case 'win32':
                binPath = path.join(chromiumAppPath, 'chrome-win', 'chrome.exe');
                break;
            case 'linux':
                binPath = path.join(chromiumAppPath, 'chrome-linux', 'chrome');
                break;
            default:
                return false;
        }

        return existsSync(binPath);
    });

    ipcMain.handle('archive:extractChromium', async (_): Promise<boolean> => {
        const platform = os.platform();
        const arch = os.arch();
        const chromiumAppPath = getChromiumAppPath();
        const resourcesPath = getResourcesPath();

        let zipPath;
        switch (platform) {
            case 'darwin':
                if (arch == 'arm64') {
                    zipPath = path.join(resourcesPath, 'chromium-mac-arm64.zip');
                } else {
                    zipPath = path.join(resourcesPath, 'chromium-mac-intel.zip');
                }
                break;
            case 'win32':
                zipPath = path.join(resourcesPath, 'chromium-win-x64.zip');
                break;
            case 'linux':
                zipPath = path.join(resourcesPath, 'chromium-linux-x64.zip');
                break;
            default:
                return false;
        }

        if (!existsSync(zipPath)) {
            console.error(`Chromium zip not found: ${zipPath}`);
            return false;
        }

        try {
            await extract(zipPath, { dir: chromiumAppPath });
            return true;
        } catch (err) {
            console.error('Failed to extract Chromium:', err);
            return false;
        }
    });
};
