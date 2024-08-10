import { contextBridge, ipcRenderer } from 'electron'
import { Account, XProgress, XJob, XArchiveTweetsStartResponse, XIsRateLimitedResponse } from './shared_types'

contextBridge.exposeInMainWorld('electron', {
    getApiUrl: (): Promise<string> => {
        return ipcRenderer.invoke('getApiUrl')
    },
    shouldOpenDevtools: (): Promise<boolean> => {
        return ipcRenderer.invoke('shouldOpenDevtools')
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
        isSingleFileExtracted: (): Promise<boolean> => {
            return ipcRenderer.invoke('archive:isSingleFileExtracted')
        },
        extractSingleFile: (): Promise<boolean> => {
            return ipcRenderer.invoke('archive:extractSingleFile')
        },
        isSingleFileExtensionInstalled: (): Promise<boolean> => {
            return ipcRenderer.invoke('archive:isSingleFileExtensionInstalled')
        },
        installSingleFileExtension: (): Promise<boolean> => {
            return ipcRenderer.invoke('archive:installSingleFileExtension')
        },
        singleFileSavePage: (): Promise<boolean> => {
            return ipcRenderer.invoke('archive:singleFileSavePage')
        },
        savePage: (webContentsID: number): Promise<boolean> => {
            return ipcRenderer.invoke('archive:savePage', webContentsID)
        },
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
        singleFile: (accountID: number, outputPath: string, urls: string[], retry: boolean): Promise<boolean> => {
            return ipcRenderer.invoke('archive:singleFile', accountID, outputPath, urls, retry)
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
        getUsername: (accountID: number, webContentsID: number): Promise<string | null> => {
            return ipcRenderer.invoke('X:getUsername', accountID, webContentsID)
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
        archiveTweetsDisplayTweet: (accountID: number, webContentsID: number, filename: string) => {
            ipcRenderer.invoke('X:archiveTweetsDisplayTweet', accountID, webContentsID, filename)
        },
        openFolder: (accountID: number, folderName: string) => {
            ipcRenderer.invoke('X:openFolder', accountID, folderName);
        },
        isRateLimited: (accountID: number, webContentsID: number, url: string): Promise<XIsRateLimitedResponse> => {
            return ipcRenderer.invoke('X:isRateLimited', accountID, webContentsID, url);
        }
    }
})