import { contextBridge, ipcRenderer } from 'electron'
import { Account, XProgress } from './shared_types'

contextBridge.exposeInMainWorld('electron', {
    getApiUrl: (): Promise<string> => {
        return ipcRenderer.invoke('getApiUrl')
    },
    isDevMode: (): Promise<boolean> => {
        return ipcRenderer.invoke('isDevMode')
    },
    showError: (message: string) => {
        ipcRenderer.invoke('showError', message)
    },
    showQuestion: (message: string, trueText: string, falseText: string): Promise<boolean> => {
        return ipcRenderer.invoke('showQuestion', message, trueText, falseText)
    },
    database: {
        getConfig: (key: string): Promise<string> => {
            return ipcRenderer.invoke('database:getConfig', key);
        },
        setConfig: (key: string, value: string) => {
            ipcRenderer.invoke('database:setConfig', key, value)
        },
        getAccounts: (): Promise<Account[]> => {
            return ipcRenderer.invoke('database:getAccounts')
        },
        createAccount: (): Promise<Account> => {
            return ipcRenderer.invoke('database:createAccount')
        },
        selectAccountType: (accountID: number, type: string): Promise<Account> => {
            return ipcRenderer.invoke('database:selectNewAccount', accountID, type)
        },
        saveAccount: (accountJSON: string) => {
            ipcRenderer.invoke('database:saveAccount', accountJSON)
        },
        deleteAccount: (accountID: number) => {
            return ipcRenderer.invoke('database:deleteAccount', accountID)
        },
    },
    mitmProxy: {
        start: (accountID: number, proxyFilter: string[]) => {
            ipcRenderer.invoke('mitmProxy:start', accountID, proxyFilter)
        },
        stop: (accountID: number) => {
            ipcRenderer.invoke('mitmProxy:stop', accountID)
        }
    },
    X: {
        indexStart: (accountID: number) => {
            ipcRenderer.invoke('X:indexStart', accountID)
        },
        indexStop: (accountID: number) => {
            ipcRenderer.invoke('X:indexStop', accountID)
        },
        indexParse: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParse', accountID)
        }
    }
})