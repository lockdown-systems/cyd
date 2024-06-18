import os from 'os'
import log from 'electron-log/main';
import { join } from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { prisma, runPrismaMigrations } from './prisma'
import { getConfig, setConfig } from './config'

const isSingleInstance = app.requestSingleInstanceLock()
if (!isSingleInstance) {
    app.quit()
    process.exit(0)
}

// Initialize the logger
log.initialize();
log.info('User data folder is at:', app.getPath('userData'))

const semiphemeralEnv = process.env.SEMIPHEMERAL_ENV;

async function createWindow() {
    // Run database migrations
    await runPrismaMigrations();

    // If a device description has not been created yet, make one now
    const deviceName = await getConfig(prisma, "deviceDescription")
    if (!deviceName) {
        let description = "";
        switch (os.platform()) {
            case 'darwin':
                description += 'macOS: ';
                break
            case 'win32':
                description += 'Windows: ';
                break
            case 'linux':
                description += 'Linux: ';
                break
            default:
                description += 'Unknown OS: ';
        }
        description += os.hostname();
        await setConfig(prisma, "deviceDescription", description)
    }

    // Create the browser window
    const win = new BrowserWindow({
        show: false,
        width: 1024,
        height: 768,
        webPreferences: {
            webviewTag: true,
            preload: join(__dirname, '../preload/index.cjs'),
            nodeIntegration: false
        },
    })

    win.on('ready-to-show', () => {
        win?.show()
    })

    // IPC events

    ipcMain.handle('getApiUrl', async () => {
        if (semiphemeralEnv == "local") {
            return "http://localhost:8080/api/v1"
        } else if (semiphemeralEnv == "staging") {
            return "https://staging-semiphemeral.fly.dev/api/v1/"
        }
        return "https://semiphemeral.com/api/v1"
    })

    ipcMain.handle('isDevMode', async (_) => {
        if (semiphemeralEnv == "local" || semiphemeralEnv == "staging") {
            return true
        }
        return false
    })

    ipcMain.handle('getConfig', async (_, key) => {
        const value = await getConfig(prisma, key)
        return value
    })

    ipcMain.handle('setConfig', async (_, key, value) => {
        await setConfig(prisma, key, value)
    })

    ipcMain.handle('getXAccounts', async (_) => {
        return await prisma.xAccount.findMany();
    })

    ipcMain.handle('createXAccount', async (_) => {
        return await prisma.xAccount.create({
            data: {}
        })
    })

    ipcMain.handle('saveXAccount', async (_, accountJson) => {
        const account = JSON.parse(accountJson)
        return await prisma.xAccount.update({
            where: { id: account.id },
            data: account
        })
    })

    const pageUrl = import.meta.env.DEV
        ? 'http://localhost:5173'
        : new URL('../dist/renderer/index.html', `file://${__dirname}`).toString()

    await win.loadURL(pageUrl)

    // If we're in local or staging, pre-open developer tools
    if (semiphemeralEnv == "local" || semiphemeralEnv == "staging") {
        win.webContents.openDevTools();
        win.setSize(1400, 768);
    }

    return win
}

app.on('second-instance', () => {
    createWindow().catch((err) =>
        log.error('Error while trying to prevent second-instance Electron event:', err)
    )
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // Create the window
    createWindow().catch((err) =>
        log.error('Error while trying to handle activate Electron event:', err)
    )
})

app.on('before-quit', async () => {
    await prisma.$disconnect()
});

app.enableSandbox()
app
    .whenReady()
    .then(createWindow)
    .catch((e) => log.error('Failed to create window:', e))