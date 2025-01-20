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
    autoUpdater,
    protocol,
    powerSaveBlocker,
    powerMonitor,
    FileFilter
} from 'electron';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';

import * as database from './database';
import { defineIPCX } from './account_x';
import { defineIPCArchive } from './archive';
import {
    getUpdatesBaseURL,
    getAccountDataPath,
    getResourcesPath,
    getSettingsPath,
    getDataPath,
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
    dialog.showErrorBox('Cyd Error', 'Cannot find config.json!');
    app.quit();
}
const config: Config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Attach the mode to the process environment
process.env.CYD_MODE = config.mode;

// Set the app name
if (config.mode == "prod") {
    // cyd with a lowercase c, for backwards compatibility
    app.setName('cyd');
} else {
    app.setName('Cyd Dev');
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

// Register the cyd:// protocol scheme
protocol.registerSchemesAsPrivileged([
    {
        scheme: "cyd",
        privileges: {
            standard: true,
        },
    },
]);

// Initialize the logger
log.initialize();
log.transports.file.level = false; // Disable file logging
log.info('Cyd version:', app.getVersion());
log.info('User data folder is at:', app.getPath('userData'));

const cydDevMode = process.env.CYD_DEV === "1";

async function initializeApp() {
    // Display message in dev mode
    if (config.mode == "dev") {
        dialog.showMessageBoxSync({
            title: `Cyd Dev ${app.getVersion()}`,
            message: `You're running Cyd ${app.getVersion()}. It uses the dev server and it might contain bugs.`,
            type: 'info',
        });
    } else if (config.mode == "local") {
        dialog.showMessageBoxSync({
            title: `Cyd Local ${app.getVersion()}`,
            message: `You're running Cyd ${app.getVersion()} in local mode.`,
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
        dialog.showErrorBox('Cyd Error', 'Failed to run database migrations. The application will now exit.');
        app.quit();
        return;
    }

    // Dismiss any stale error reports
    database.dismissAllNewErrorReports();

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

    // Make sure the data path is created and the config setting is saved
    getDataPath();

    // Create the window
    await createWindow();
}

async function createWindow() {
    // Create the browser window
    const icon = nativeImage.createFromPath(path.join(getResourcesPath(), 'icon.png'));
    const win = new BrowserWindow({
        width: 1000,
        height: 850,
        minWidth: 900,
        minHeight: 700,
        webPreferences: {
            webviewTag: true,
            preload: path.join(__dirname, './preload.js')
        },
        icon: icon,
    });

    // Protocol handler for cyd:// URLs
    protocol.handle('cyd', (req) => {
        log.info('Received cyd:// URL:', req.url);
        const { hostname, pathname } = new URL(req.url)

        // Validate the hostname
        const validHostnames = ['social.cyd.api', 'social.cyd.dev-api'];
        if (!validHostnames.includes(hostname)) {
            dialog.showMessageBoxSync({
                title: "Cyd",
                message: `Invalid hostname in cyd:// URL: ${req.url}`,
                type: 'info',
            });
            return new Response('bad', {
                status: 400,
                headers: { 'content-type': 'text/html' }
            })
        }

        // Make sure the pathname is supported
        if (pathname == "open") {
            // Supported! Do nothing, since the app should now be opened
            log.info('protocol handler opening app');
        } else {
            dialog.showMessageBoxSync({
                title: "Cyd",
                message: `Invalid path in cyd:// URL: ${req.url}`,
                type: 'info',
            });
            return new Response('bad', {
                status: 400,
                headers: { 'content-type': 'text/html' }
            })
        }

        // Return a successful response
        log.info('protocol handler returning ok');
        return new Response('ok', {
            status: 200,
            headers: { 'content-type': 'text/html' }
        })
    })

    // Handle power monitor events

    powerMonitor.on('suspend', () => {
        log.info('System is suspending');
        try {
            win.webContents.send('powerMonitor:suspend');
        } catch (error) {
            log.error('Failed to send powerMonitor:suspend to renderer:', error);
        }
    });

    powerMonitor.on('resume', () => {
        log.info('System has resumed');
        try {
            win.webContents.send('powerMonitor:resume');
        } catch (error) {
            log.error('Failed to send powerMonitor:resume to renderer:', error);
        }
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
                            title: "Cyd",
                            message: `An update is available and is downloading in the background. You will be prompted to install it once it's ready.`,
                            type: 'info',
                        });
                        autoUpdater.off('update-available', updateAvailable);
                        autoUpdater.off('update-not-available', updateNotAvailable);
                        autoUpdater.off('error', updateError);
                    };
                    const updateNotAvailable = () => {
                        dialog.showMessageBoxSync({
                            title: "Cyd",
                            message: `You are using the latest version, Cyd ${app.getVersion()}.`,
                            type: 'info',
                        });
                        autoUpdater.off('update-available', updateAvailable);
                        autoUpdater.off('update-not-available', updateNotAvailable);
                        autoUpdater.off('error', updateError);
                    };
                    const updateError = (error: Error) => {
                        dialog.showMessageBoxSync({
                            title: "Cyd",
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
                    // Linux updates are done through the package manager
                    dialog.showMessageBoxSync({
                        title: "Cyd",
                        message: `You are running Cyd ${app.getVersion()}.\n\nInstall updates with your Linux package manager to make sure you're on the latest version.`,
                        type: 'info',
                    });
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

        ipcMain.handle('getMode', async () => {
            try {
                return config.mode;
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
                return cydDevMode;
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('showMessage', async (_, message: string) => {
            try {
                dialog.showMessageBoxSync({
                    title: "Cyd",
                    message: message,
                    type: 'info',
                });
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('showError', async (_, message: string) => {
            try {
                dialog.showErrorBox('Cyd Error', message);
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('showQuestion', async (_, message: string, trueText: string, falseText: string) => {
            try {
                const result = dialog.showMessageBoxSync({
                    title: "Cyd",
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

        ipcMain.handle('showOpenDialog', async (_, selectFolders: boolean, selectFiles: boolean, fileFilters: FileFilter[] | undefined = undefined): Promise<string | null> => {
            const dataPath = database.getConfig('dataPath');

            const properties: ("openFile" | "openDirectory" | "multiSelections" | "showHiddenFiles" | "createDirectory" | "promptToCreate" | "noResolveAliases" | "treatPackageAsDirectory" | "dontAddToRecent")[] = [];
            if (selectFolders) {
                properties.push('openDirectory');
                properties.push('createDirectory');
                properties.push('promptToCreate');
            }
            if (selectFiles) {
                properties.push('openFile');
            }

            const options: Electron.OpenDialogSyncOptions = {
                properties: properties,
                filters: fileFilters,
            };
            if (dataPath) {
                options.defaultPath = dataPath;
            }

            try {
                const result = dialog.showOpenDialogSync(win, options);
                if (result && result.length > 0) {
                    return result[0];
                }
                return null;
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

        ipcMain.handle('deleteSettingsAndRestart', async (_) => {
            try {
                // Close the database
                database.closeMainDatabase();

                // Delete settings
                const settingsPath = getSettingsPath();
                fs.rmSync(settingsPath, { recursive: true, force: true });
                log.info('Deleted settings folder:', settingsPath);

                // Delete partitions
                const partitionsPath = path.join(app.getPath('userData'), 'Partitions');
                fs.rmSync(partitionsPath, { recursive: true, force: true });
                log.info('Deleted partitions folder:', partitionsPath);

                // Restart app
                app.relaunch();
                app.exit(0)
            } catch (error) {
                throw new Error(packageExceptionForReport(error as Error));
            }
        });

        ipcMain.handle('startPowerSaveBlocker', async (_): Promise<number> => {
            const powerSaveBlockerID = powerSaveBlocker.start('prevent-app-suspension');
            log.info('Started power save blocker with ID:', powerSaveBlockerID);
            return powerSaveBlockerID;
        });

        ipcMain.handle('stopPowerSaveBlocker', async (_, powerSaveBlockerID: number) => {
            powerSaveBlocker.stop(powerSaveBlockerID)
            log.info('Stopped power save blocker with ID:', powerSaveBlockerID);
        });

        // Other IPC events
        database.defineIPCDatabase();
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
    if (cydDevMode) {
        win.webContents.openDevTools();
        win.setSize(1500, 900);
    }

    // When devtools opens, make sure the window is wide enough
    win.webContents.on('devtools-opened', () => {
        const [width, height] = win.getSize();
        if (width < 1500) {
            win.setSize(1500, height);
        }
    });

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
