import { contextBridge, ipcRenderer } from 'electron'
import type { XAccount } from './types'

contextBridge.exposeInMainWorld('electron', {
    getApiUrl: (): Promise<string> => {
        return ipcRenderer.invoke('getApiUrl')
    },
    isDevMode: (): Promise<boolean> => {
        return ipcRenderer.invoke('isDevMode')
    },
    getConfig: (key: string): Promise<string> => {
        return ipcRenderer.invoke('getConfig', key);
    },
    setConfig: (key: string, value: string) => {
        ipcRenderer.invoke('setConfig', key, value)
    },
    getXAccounts: (): Promise<XAccount[]> => {
        return ipcRenderer.invoke('getXAccounts')
    },
    createXAccount: (): Promise<XAccount> => {
        return ipcRenderer.invoke('createXAccount')
    },
    saveXAccount: (accountJSON: string) => {
        ipcRenderer.invoke('saveXAccount', accountJSON)
    }
})