import process from 'process';
import os from 'os';
import path from 'path';
import fs from 'fs';

import log from 'electron-log/main';
import { app, BrowserWindow, ipcMain, dialog, shell, webContents, nativeImage } from 'electron';

import {
    runMainMigrations,
    getConfig,
    setConfig,
    defineIPCDatabase,
    getAccount,
    getAccountUsername,
} from './database';
import { defineIPCX } from './account_x';
import { defineIPCArchive } from './archive';
import { getAccountDataPath, getResourcesPath, trackEvent } from './helpers';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

interface Config {
    mode: string;
    apiURL: string;
    dashURL: string;
    plausibleDomain: string;
}

// Load the config
const configPath = path.join(getResourcesPath(), 'config.json');
if (!fs.existsSync(configPath)) {
    dialog.showErrorBox('Semiphemeral Error', 'Cannot find config.json!');
    app.quit();
}
const config: Config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

// Initialize the logger
log.initialize();
log.transports.file.level = false; // Disable file logging
log.info('User data folder is at:', app.getPath('userData'));

const semiphemeralDevtools = process.env.SEMIPHEMERAL_DEVTOOLS === "1";

async function initializeApp() {
    // Display message in dev mode
    if (config.mode == "dev") {
        dialog.showMessageBoxSync({
            title: `Semiphemeral ${app.getVersion()}`,
            message: `You're running Semiphemeral ${app.getVersion()}. It uses the dev server and it might contain bugs.`,
            type: 'info',
        });
    } else if (config.mode == "local") {
        dialog.showMessageBoxSync({
            title: `Semiphemeral ${app.getVersion()}`,
            message: `You're running Semiphemeral ${app.getVersion()} in local mode.`,
            type: 'info',
        });
    }

    // Set the log level
    if (config.mode == "dev" || config.mode == "local") {
        log.transports.console.level = "debug";
    } else {
        log.transports.console.level = "info";
    }
    log.info(`Started with log level ${log.transports.console.level}`);

    // Run database migrations
    try {
        runMainMigrations();
    } catch (error) {
        log.error("Failed to run migrations:", error);
        dialog.showErrorBox('Semiphemeral Error', 'Failed to run database migrations. The application will now exit.');
        app.quit();
        return;
    }

    // If a device description has not been created yet, make one now
    const deviceDescription = getConfig("deviceDescription");
    if (!deviceDescription) {
        let description = "";
        switch (os.platform()) {
            case 'darwin':
                description += 'macOS: ';
                break;
            case 'win32':
                description += 'Windows: ';
                break;
            case 'linux':
                description += 'Linux: ';
                break;
            default:
                description += 'Unknown OS: ';
        }
        description += os.hostname();
        setConfig("deviceDescription", description);
    }

    await createWindow();
}

async function createWindow() {
    // Create the browser window
    const icon = nativeImage.createFromPath(path.join(getResourcesPath(), 'icon.png'));
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        webPreferences: {
            webviewTag: true,
            preload: path.join(__dirname, './preload.js')
        },
        icon: icon
    });

    // IPC events

    if (!global.ipcHandlersRegistered) {
        ipcMain.handle('getAPIURL', async () => {
            return config.apiURL;
        });

        ipcMain.handle('getDashURL', async () => {
            return config.dashURL;
        });

        ipcMain.handle('trackEvent', async (_, eventName: string, userAgent: string) => {
            trackEvent(eventName, userAgent, config.plausibleDomain);
        });

        ipcMain.handle('shouldOpenDevtools', async (_) => {
            return semiphemeralDevtools;
        });

        ipcMain.handle('showMessage', async (_, message: string) => {
            dialog.showMessageBoxSync({
                message: message,
                type: 'info',
            });
        });

        ipcMain.handle('showError', async (_, message: string) => {
            dialog.showErrorBox('Semiphemeral Error', message);
        });

        ipcMain.handle('showQuestion', async (_, message: string, trueText: string, falseText: string) => {
            const result = dialog.showMessageBoxSync({
                message: message,
                type: 'question',
                buttons: [falseText, trueText],
                defaultId: 0,
            });
            return result === 1;
        });

        ipcMain.handle('openURL', async (_, url) => {
            shell.openExternal(url);
        });

        ipcMain.handle('loadFileInWebview', async (_, webContentsId: number, filename: string) => {
            const wc = webContents.fromId(webContentsId);
            if (wc) {
                await wc.loadFile(filename);
            }
        });

        ipcMain.handle('getAccountDataPath', async (_, accountID: number, filename: string): Promise<string | null> => {
            const account = getAccount(accountID);
            if (!account) {
                return null;
            }
            const username = await getAccountUsername(account);
            if (!username) {
                return null;
            }

            const archivePath = getAccountDataPath(account.type, username);
            if (filename == '') {
                return archivePath;
            } else {
                return path.join(archivePath, filename);
            }
        });

        defineIPCDatabase();
        defineIPCX();
        defineIPCArchive();
    }
    global.ipcHandlersRegistered = true;

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    };

    // Open dev tools?
    if (semiphemeralDevtools) {
        win.webContents.openDevTools();
        win.setSize(1500, 800);
    }

    return win;
}

app.enableSandbox();
app.on('ready', initializeApp);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
