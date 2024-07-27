import { createServer } from 'net'
import fs from 'fs'
import path from "path"
import os from 'os'

import { app } from 'electron'

export const getResourcesPath = () => {
    if (!process.env.NODE_ENV || process.env.NODE_ENV === "production") {
        return process.resourcesPath;
    }
    return path.join(__dirname, "..", "..", "build");
}

export const getSettingsPath = () => {
    const settingsPath = path.join(app.getPath('userData'), "settings");
    if (!fs.existsSync(settingsPath)) {
        fs.mkdirSync(settingsPath);
    }
    return settingsPath;
}

export const getAccountSettingsPath = (accountID: number) => {
    const settingsPath = getSettingsPath();
    const accountSettingsPath = path.join(settingsPath, `account-${accountID}`);
    if (!fs.existsSync(accountSettingsPath)) {
        fs.mkdirSync(accountSettingsPath);
    }
    return accountSettingsPath;
}

export const getDataPath = () => {
    const dataPath = path.join(os.homedir(), 'Documents', 'Semiphemeral');
    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath);
    }
    return dataPath;
}

export const getAccountDataPath = (accountType: string, accountUsername: string) => {
    const dataPath = getDataPath();
    const accountDataPath = path.join(dataPath, accountType);
    if (!fs.existsSync(accountDataPath)) {
        fs.mkdirSync(accountDataPath);
    }
    const accountUserDataPath = path.join(accountDataPath, accountUsername);
    if (!fs.existsSync(accountUserDataPath)) {
        fs.mkdirSync(accountUserDataPath);
    }
    return accountUserDataPath;
}

export const getChromiumAppPath = () => {
    const chromiumAppPath = path.join(app.getPath('userData'), "chromium-app");
    if (!fs.existsSync(chromiumAppPath)) {
        fs.mkdirSync(chromiumAppPath);
    }
    return chromiumAppPath;
}

export const getChromiumBinPath = () => {
    const platform = os.platform();
    const chromiumAppPath = getChromiumAppPath();

    switch (platform) {
        case 'darwin':
            return path.join(chromiumAppPath, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
        case 'win32':
            return path.join(chromiumAppPath, 'chrome-win', 'chrome.exe');
        case 'linux':
            return path.join(chromiumAppPath, 'chrome-linux', 'chrome');
        default:
            return null;
    }
}

export const getSinglefileBinPath = () => {
    const platform = os.platform();
    const arch = os.arch();
    const resourcePath = getResourcesPath();

    switch (platform) {
        case 'darwin':
            if (arch == 'arm64') {
                return path.join(resourcePath, 'single-file-aarch64-apple-darwin');
            } else {
                return path.join(resourcePath, 'single-file-x86_64-apple-darwin');
            }
        case 'win32':
            return path.join(resourcePath, 'single-file.exe');
        case 'linux':
            return path.join(resourcePath, 'single-file-x86_64-linux');
        default:
            return null;
    }
}

export async function findOpenPort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                return reject(new Error('No address'));
            }
            const port = address.port;
            server.close(() => {
                resolve(port);
            });
        });
    });
}
