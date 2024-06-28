import { contextBridge, ipcRenderer } from 'electron'
import { Account } from './shared_types'

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
    getAccounts: (): Promise<Account[]> => {
        return ipcRenderer.invoke('getXAccounts')
    },
    createAccount: (): Promise<Account> => {
        return ipcRenderer.invoke('createXAccount')
    },
    saveAccount: (accountJSON: string) => {
        ipcRenderer.invoke('saveAccount', accountJSON)
    }
})