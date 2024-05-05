import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
    openUrl: (url: string) => {
        ipcRenderer.send('open-url', url)
    }
})