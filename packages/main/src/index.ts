import log from 'electron-log/main';
import { join } from 'node:path'
import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { PrismaClient } from '@prisma/client'
import { getConfig } from './config'

const isSingleInstance = app.requestSingleInstanceLock()
if (!isSingleInstance) {
    app.quit()
    process.exit(0)
}

const prisma = new PrismaClient()

// Initialize the logger
log.initialize();
log.info('User data folder is at:', app.getPath('userData'))

async function createWindow() {
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

    ipcMain.on('open-url', (event, url) => {
        shell.openExternal(url)
    })

    ipcMain.on('get-user', async (event) => {
        const loggedInUser: string | null = await getConfig(prisma, 'loggedInUser')
        return loggedInUser
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
    createWindow().catch((err) =>
        log.error('Error while trying to handle activate Electron event:', err)
    )
})

app.on('before-quit', async () => {
    await prisma.$disconnect()
});

app
    .whenReady()
    .then(createWindow)
    .catch((e) => log.error('Failed to create window:', e))