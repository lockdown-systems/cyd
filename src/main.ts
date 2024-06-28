import process from 'process';
import os from 'os';
import log from 'electron-log/main';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { runMigrations, getConfig, setConfig, getAccounts, createAccount, saveAccount } from './database';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
    app.quit();
    process.exit(0);
}

// Initialize the logger
log.initialize();
log.info('User data folder is at:', app.getPath('userData'));

const semiphemeralEnv = process.env.SEMIPHEMERAL_ENV;
let win: BrowserWindow | null = null;

async function initializeApp() {
    // Run database migrations
    try {
        await runMigrations();
    } catch (error) {
        console.error("Failed to run migrations:", error);
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
    // Set the icon in Linux (in macOS and Windows it's set in forge.config.ts)
    let icon: string | undefined = undefined;
    if (os.platform() === 'linux') {
        icon = join(__dirname, '../renderer/main_window/icon.png');
    }

    // Create the browser window
    win = new BrowserWindow({
        show: false,
        width: 1024,
        height: 768,
        webPreferences: {
            webviewTag: true,
            preload: join(__dirname, './preload.js'),
            nodeIntegration: false
        },
        icon: icon
    });

    win.on('ready-to-show', () => {
        win?.show();
    });

    // IPC events

    if (!global.ipcHandlersRegistered) {
        ipcMain.handle('getApiUrl', async () => {
            if (semiphemeralEnv == "local") {
                return "http://localhost:8080/v1";
            } else if (semiphemeralEnv == "dev") {
                return "https://dev-api.semiphemeral.com/v1";
            }
            return "https://api.semiphemeral.com/v1";
        });

        ipcMain.handle('isDevMode', async (_) => {
            if (semiphemeralEnv == "local" || semiphemeralEnv == "dev") {
                return true;
            }
            return false;
        });

        ipcMain.handle('getConfig', async (_, key) => {
            return getConfig(key);
        });

        ipcMain.handle('setConfig', async (_, key, value) => {
            setConfig(key, value);
        });

        ipcMain.handle('getAccounts', async (_) => {
            return getAccounts();
        });

        ipcMain.handle('createAccount', async (_) => {
            return createAccount();
        });

        ipcMain.handle('saveAccount', async (_, accountJson) => {
            const account = JSON.parse(accountJson);
            return saveAccount(account);
        });

        ipcMain.handle('showError', async (_, message) => {
            dialog.showErrorBox('Semiphemeral Error', message);
        });
    }
    global.ipcHandlersRegistered = true;

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    };

    // If we're in local or staging, pre-open developer tools
    if (semiphemeralEnv == "local" || semiphemeralEnv == "dev") {
        win.webContents.openDevTools();
        win.setSize(1400, 768);
    }

    return win;
}

app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
    }
});

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

app.enableSandbox();
app
    .whenReady()
    .then(initializeApp)
    .catch((e) => log.error('Failed to initialize app and create window:', e));