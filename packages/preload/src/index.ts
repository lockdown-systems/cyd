import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
    getApiUrl: (): Promise<string> => {
        return ipcRenderer.invoke('getApiUrl')
    },
    getConfig: (key: string): Promise<string> => {
        return ipcRenderer.invoke('getConfig', key);
    },
    setConfig: (key: string, value: string) => {
        ipcRenderer.send('setConfig', key, value)
    },
    getXAccounts: (): Promise<XAccount[]> => {
        return ipcRenderer.invoke('getXAccounts')
    },
    createXAccount: (): Promise<XAccount> => {
        return ipcRenderer.invoke('createXAccount')
    }
})