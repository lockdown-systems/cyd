import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
    getApiUrl: (): Promise<string> => {
        return ipcRenderer.invoke('getApiUrl')
    },
    getConfig: (key: string): Promise<string> => {
        return ipcRenderer.invoke('getConfig', key);
    },
    setConfig: (key: string, value: string) => {
        ipcRenderer.send('setConfig', key, value)
    },
    authenticate: () => {
        ipcRenderer.send('authenticate')
    },
    token: () => {
        ipcRenderer.send('token')
    }
})