import "reflect-metadata" // Required by TypeORM
import log from 'electron-log/main';
import { join } from 'node:path'
import { app, BrowserWindow, shell, ipcMain } from 'electron'

import { initializeDatabase } from "./database"

const isSingleInstance = app.requestSingleInstanceLock()

if (!isSingleInstance) {
    app.quit()
    process.exit(0)
}

// Initialize the logger
log.initialize();
log.info('User data folder is at:', app.getPath('userData'))

// Initialize the data source
log.info('Initializing data source...')
const appDataSource = initializeDatabase()

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

    ipcMain.on('get-user', (event) => {
        // TODO: return logged in user
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
        console.error('Error while trying to prevent second-instance Electron event:', err)
    )
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    createWindow().catch((err) =>
        console.error('Error while trying to handle activate Electron event:', err)
    )
})

app
    .whenReady()
    .then(createWindow)
    .catch((e) => console.error('Failed to create window:', e))