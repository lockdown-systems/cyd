import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
    openUrl: (url: string) => {
        ipcRenderer.send('open-url', url)
    },
    getUser: () => {
        ipcRenderer.send('get-user')
    },
    authenticate: () => {
        ipcRenderer.send('authenticate')
    },
    token: () => {
        ipcRenderer.send('token')
    }
})