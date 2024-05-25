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

async function createWindow() {
    // Run database migrations
    await runPrismaMigrations();

    // Create the browser window
    const browserWindow = new BrowserWindow({
        show: false,
        width: 1024,
        height: 768,
        webPreferences: {
            webviewTag: true,
            preload: join(__dirname, '../preload/index.cjs'),
            nodeIntegration: false
        },
    })

    browserWindow.on('ready-to-show', () => {
        browserWindow?.show()
    })

    // IPC events

    ipcMain.handle('getConfig', async (_, key) => {
        const value = await getConfig(prisma, key)
        return value
    })

    ipcMain.on('setConfig', async (_, key, value) => {
        await setConfig(prisma, key, value)
    })

    ipcMain.on('authenticate', (event) => {
        // TODO: authenticate with server
    })

    ipcMain.on('token', (event) => {
        // TODO: get a token from the server
    })

    const pageUrl = import.meta.env.DEV
        ? 'http://localhost:5173'
        : new URL('../dist/renderer/index.html', `file://${__dirname}`).toString()

    await browserWindow.loadURL(pageUrl)

    return browserWindow
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