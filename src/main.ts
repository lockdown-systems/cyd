import process from 'process';
import os from 'os';
import path from 'path';
import fs from 'fs';

import log from 'electron-log/main';
import {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    shell,
    webContents,
    nativeImage,
    session,
    autoUpdater
} from 'electron';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';

import * as database from './database';
import { defineIPCX } from './account_x';
import { defineIPCArchive } from './archive';
import {
    getUpdatesBaseURL,
    getAccountDataPath,
    getResourcesPath,
    trackEvent,
    packageExceptionForReport
} from './util';

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
        database.runMainMigrations();
    } catch (error) {
        log.error("Failed to run migrations:", error);
        dialog.showErrorBox('Semiphemeral Error', 'Failed to run database migrations. The application will now exit.');
        app.quit();
        return;
    }

    // If a device description has not been created yet, make one now
    const deviceDescription = database.getConfig("deviceDescription");
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
        database.setConfig("deviceDescription", description);
    }

    // Set up auto-updates for Windows and macOS
    if (os.platform() == 'win32' || os.platform() == 'darwin') {
        updateElectronApp({
            updateSource: {
                type: UpdateSourceType.StaticStorage,
                baseUrl: getUpdatesBaseURL(config.mode)
            }
        });
    }

    // Create the window
    await createWindow();
}

async function createWindow() {
    // Create the browser window
    const icon = nativeImage.createFromPath(path.join(getResourcesPath(), 'icon.png'));
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        minWidth: 900,
        minHeight: 700,
        webPreferences: {
            webviewTag: true,
            preload: path.join(__dirname, './preload.js')
        },
        icon: icon
    });

    // IPC events

    // @ts-expect-error: typescript doesn't know about this global variable
    if (!global.ipcHandlersRegistered) {

        // Main IPC events

        ipcMain.handle('checkForUpdates', async () => {
            try {
                if (os.platform() == 'darwin' || os.platform() == 'win32') {
                    const updateAvailable = () => {
                        dialog.showMessageBoxSync({
                            message: `An update is available and is downloading in the background. You will be prompted to install it once it's ready.`,
                            type: 'info',
                        });
                        autoUpdater.off('update-available', updateAvailable);
                        autoUpdater.off('update-not-available', updateNotAvailable);
                        autoUpdater.off('error', updateError);
                    };
                    const updateNotAvailable = () => {
                        dialog.showMessageBoxSync({
                            message: `You are using the latest version, Semiphemeral ${app.getVersion()}.`,
                            type: 'info',
                        });
                        autoUpdater.off('update-available', updateAvailable);
                        autoUpdater.off('update-not-available', updateNotAvailable);
                        autoUpdater.off('error', updateError);
                    };
                    const updateError = (error: Error) => {
                        dialog.showMessageBoxSync({
                            message: `Error checking for updates: ${error.toString()}`,
                            type: 'info',
                        });
                        autoUpdater.off('update-available', updateAvailable);
                        autoUpdater.off('update-not-available', updateNotAvailable);
                        autoUpdater.off('error', updateError);
                    }

                    autoUpdater.on('update-available', updateAvailable);
                    autoUpdater.on('update-not-available', updateNotAvailable);
                    autoUpdater.on('error', updateError);

                    autoUpdater.checkForUpdates();

                    setTimeout(() => {
                        autoUpdater.off('update-available', updateAvailable);
                        autoUpdater.off('update-not-available', updateNotAvailable);
                    }, 10000);
                } else {
                    // Linux does not support automatic updates

                    // TODO: check for updates on Linux

                    dialog.showMessageBoxSync({
                        message: "Automatic updates are not supported on Linux.",
                        type: 'info',
                    });

                    // const requestHeaders = { 'User-Agent': `Semiphemeral/${app.getVersion()} (${os.platform()})` };
                    // autoUpdater.setFeedURL({
                    //     url: getUpdatesBaseURL(config.mode) + '/RELEASES.json',
                    //     headers: requestHeaders
                    // });
                }
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('getVersion', async () => {
            try {
                return app.getVersion();
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('getPlatform', async () => {
            try {
                return os.platform();
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('getAPIURL', async () => {
            try {
                return config.apiURL;
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('getDashURL', async () => {
            try {
                return config.dashURL;
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('trackEvent', async (_, eventName: string, userAgent: string) => {
            try {
                trackEvent(eventName, userAgent, config.plausibleDomain);
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('shouldOpenDevtools', async (_) => {
            try {
                return semiphemeralDevtools;
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('showMessage', async (_, message: string) => {
            try {
                dialog.showMessageBoxSync({
                    message: message,
                    type: 'info',
                });
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('showError', async (_, message: string) => {
            try {
                dialog.showErrorBox('Semiphemeral Error', message);
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('showQuestion', async (_, message: string, trueText: string, falseText: string) => {
            try {
                const result = dialog.showMessageBoxSync({
                    message: message,
                    type: 'question',
                    buttons: [falseText, trueText],
                    defaultId: 0,
                });
                return result === 1;
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('openURL', async (_, url) => {
            try {
                shell.openExternal(url);
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('loadFileInWebview', async (_, webContentsId: number, filename: string) => {
            try {
                const wc = webContents.fromId(webContentsId);
                if (wc) {
                    await wc.loadFile(filename);
                }
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('getAccountDataPath', async (_, accountID: number, filename: string): Promise<string | null> => {
            try {
                const account = database.getAccount(accountID);
                if (!account) {
                    return null;
                }
                const username = await database.getAccountUsername(account);
                if (!username) {
                    return null;
                }

                const archivePath = getAccountDataPath(account.type, username);
                if (filename == '') {
                    return archivePath;
                } else {
                    return path.join(archivePath, filename);
                }
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        // Database IPC events

        ipcMain.handle('database:getConfig', async (_, key) => {
            try {
                return database.getConfig(key);
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('database:setConfig', async (_, key, value) => {
            try {
                database.setConfig(key, value);
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('database:getAccounts', async (_) => {
            try {
                return database.getAccounts();
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('database:createAccount', async (_) => {
            try {
                return database.createAccount();
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('database:selectAccountType', async (_, accountID, type) => {
            try {
                return database.selectAccountType(accountID, type);
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('database:saveAccount', async (_, accountJson) => {
            try {
                const account = JSON.parse(accountJson);
                return database.saveAccount(account);
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('database:deleteAccount', async (_, accountID) => {
            try {
                const ses = session.fromPartition(`persist:account-${accountID}`);
                await ses.closeAllConnections();
                await ses.clearStorageData();
                database.deleteAccount(accountID);
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        // Other IPC events

        defineIPCX();
        defineIPCArchive();
    }
    // @ts-expect-error: typescript doesn't know about this global variable
    global.ipcHandlersRegistered = true;

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(path.join(__dirname, "..", "renderer", MAIN_WINDOW_VITE_NAME, "index.html"));
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
