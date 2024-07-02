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
        return ipcRenderer.invoke('getAccounts')
    },
    createAccount: (): Promise<Account> => {
        return ipcRenderer.invoke('createAccount')
    },
    selectAccountType: (accountID: number, type: string): Promise<Account> => {
        return ipcRenderer.invoke('selectNewAccount', accountID, type)
    },
    saveAccount: (accountJSON: string) => {
        ipcRenderer.invoke('saveAccount', accountJSON)
    },
    showError: (message: string) => {
        ipcRenderer.invoke('showError', message)
    }
})