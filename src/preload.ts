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
    deleteAccount: (accountID: number) => {
        return ipcRenderer.invoke('deleteAccount', accountID)
    },
    showError: (message: string) => {
        ipcRenderer.invoke('showError', message)
    },
    showQuestion: (message: string, trueText: string, falseText: string): Promise<boolean> => {
        return ipcRenderer.invoke('showQuestion', message, trueText, falseText)
    },
    X: {
        getMostRecentTweetTimestamp: (username: string): Promise<string> => {
            return ipcRenderer.invoke('X:getMostRecentTweetTimestamp', username)
        },
        getMostRecentDirectMessageTimestamp: (username: string): Promise<string> => {
            return ipcRenderer.invoke('X:getMostRecentDirectMessageTimestamp', username)
        },
    }
})