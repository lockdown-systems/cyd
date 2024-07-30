import { contextBridge, ipcRenderer } from 'electron'
import { Account, XProgress, XJob, XArchiveTweetsStartResponse } from './shared_types'

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
    openURL: (url: string) => {
        ipcRenderer.invoke('openURL', url)
    },
    loadFileInWebview: (webContentsId: number, filename: string) => {
        ipcRenderer.invoke('loadFileInWebview', webContentsId, filename)
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
    archive: {
        isChromiumExtracted: (): Promise<boolean> => {
            return ipcRenderer.invoke('archive:isChromiumExtracted')
        },
        extractChromium: (): Promise<boolean> => {
            return ipcRenderer.invoke('archive:extractChromium')
        },
        saveCookiesFile: (accountID: number) => {
            ipcRenderer.invoke('archive:saveCookiesFile', accountID)
        },
        deleteCookiesFile: (accountID: number) => {
            ipcRenderer.invoke('archive:deleteCookiesFile', accountID)
        },
        singleFile: (accountID: number, outputPath: string, urlsPath: string): Promise<boolean> => {
            return ipcRenderer.invoke('archive:singleFile', accountID, outputPath, urlsPath)
        },
    },
    X: {
        createJobs: (accountID: number, jobTypes: string[]): Promise<XJob[]> => {
            return ipcRenderer.invoke('X:createJobs', accountID, jobTypes)
        },
        getLastFinishedJob: (accountID: number, jobType: string): Promise<XJob | null> => {
            return ipcRenderer.invoke('X:getLastFinishedJob', accountID, jobType)
        },
        updateJob: (accountID: number, jobJSON: XJob) => {
            ipcRenderer.invoke('X:updateJob', accountID, jobJSON)
        },
        indexStart: (accountID: number) => {
            ipcRenderer.invoke('X:indexStart', accountID)
        },
        indexStop: (accountID: number) => {
            ipcRenderer.invoke('X:indexStop', accountID)
        },
        indexParse: (accountID: number, isFirstRun: boolean): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParse', accountID, isFirstRun)
        },
        indexFinished: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexFinished', accountID)
        },
        archiveTweetsStart: (accountID: number): Promise<XArchiveTweetsStartResponse | null> => {
            return ipcRenderer.invoke('X:archiveTweetsStart', accountID)
        },
        archiveTweetsGetProgress: (accountID: number): Promise<string[]> => {
            return ipcRenderer.invoke('X:archiveTweetsGetProgress', accountID)
        },
        openFolder: (accountID: number, folderName: string) => {
            ipcRenderer.invoke('X:openFolder', accountID, folderName);
        }
    }
})