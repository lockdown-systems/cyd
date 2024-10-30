import { createServer } from 'net'
import fs from 'fs'
import path from "path"
import os from 'os'

import { app } from 'electron';
import { getConfig, setConfig } from './database';

export const getUpdatesBaseURL = (mode: string): string => {
    let updateArch = process.arch.toString();
    if (os.platform() == 'darwin') {
        updateArch = 'universal';
    }
    let platform = process.platform.toString();
    if (platform == 'win32') {
        platform = 'windows';
    }
    if (platform == 'darwin') {
        platform = 'macos';
    }
    return `https://releases.lockdown.systems/cyd/${mode}/${platform}/${updateArch}`;
}

export const getResourcesPath = () => {
    if (!process.env.NODE_ENV || process.env.NODE_ENV === "production") {
        return process.resourcesPath;
    }
    return "build";
}

export const getSettingsPath = () => {
    if (process.env.TEST_MODE === '1' && process.env.TEST_SETTINGS_PATH) {
        return process.env.TEST_SETTINGS_PATH;
    }

    const settingsPath = path.join(app.getPath('userData'), "settings");
    if (!fs.existsSync(settingsPath)) {
        fs.mkdirSync(settingsPath, { recursive: true });
    }
    return settingsPath;
}

export const getAccountSettingsPath = (accountID: number) => {
    const settingsPath = getSettingsPath();
    const accountSettingsPath = path.join(settingsPath, `account-${accountID}`);
    if (!fs.existsSync(accountSettingsPath)) {
        fs.mkdirSync(accountSettingsPath, { recursive: true });
    }
    return accountSettingsPath;
}

export const getAccountTempPath = (accountID: number) => {
    const settingsPath = getSettingsPath();
    const accountSettingsPath = path.join(settingsPath, `account-${accountID}`);
    const accountTempPath = path.join(accountSettingsPath, 'tmp');
    if (!fs.existsSync(accountTempPath)) {
        fs.mkdirSync(accountTempPath, { recursive: true });
    }
    return accountTempPath;
}

export const getDataPath = () => {
    if (process.env.TEST_MODE === '1' && process.env.TEST_DATA_PATH) {
        return process.env.TEST_DATA_PATH;
    }

    // Get dataPath from config
    let dataPath = getConfig('dataPath');
    if (!dataPath) {
        dataPath = path.join(app.getPath('documents'), 'Cyd');
        setConfig('dataPath', dataPath);
    }

    // Make sure the folder exists
    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
    }

    return dataPath;
}

export const getAccountDataPath = (accountType: string, accountUsername: string) => {
    const dataPath = getDataPath();
    const accountDataPath = path.join(dataPath, accountType);
    if (!fs.existsSync(accountDataPath)) {
        fs.mkdirSync(accountDataPath, { recursive: true });
    }
    const accountUserDataPath = path.join(accountDataPath, accountUsername);
    if (!fs.existsSync(accountUserDataPath)) {
        fs.mkdirSync(accountUserDataPath, { recursive: true });
    }
    return accountUserDataPath;
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

export const trackEvent = (eventName: string, userAgent: string, plausibleDomain: string) => {
    // Track an event using Plausible
    // https://plausible.io/docs/events-api

    // Run the fetch request asynchronously without blocking
    setTimeout(async () => {
        try {
            await fetch('https://plausible.io/api/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': userAgent,
                },
                body: JSON.stringify({
                    name: eventName,
                    url: `https://${plausibleDomain}/`,
                    domain: plausibleDomain,
                }),
            });
        } catch (error) {
            // Fail silently
        }
    }, 0);
};

export const packageExceptionForReport = (error: Error) => {
    return JSON.stringify({
        message: error.message,
        name: error.name,
        stack: error.stack,
    });
}

export function getTimestampDaysAgo(days: number): string {
    const now = new Date();
    now.setDate(now.getDate() - days);
    return now.toISOString();
}