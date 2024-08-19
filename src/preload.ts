import { contextBridge, ipcRenderer } from 'electron'
import { Account, XProgress, XJob, XArchiveStartResponse, XIndexDMsStartResponse, XIsRateLimitedResponse } from './shared_types'

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
    getAccountDataPath: (accountID: number, filename: string): Promise<string | null> => {
        return ipcRenderer.invoke('getAccountDataPath', accountID, filename)
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
        isPageAlreadySaved: (outputPath: string, basename: string): Promise<boolean> => {
            return ipcRenderer.invoke('archive:isPageAlreadySaved', outputPath, basename)
        },
        savePage: (webContentsID: number, outputPath: string, basename: string): Promise<boolean> => {
            return ipcRenderer.invoke('archive:savePage', webContentsID, outputPath, basename)
        }
    },
    X: {
        resetProgress: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:resetProgress', accountID)
        },
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
        indexParseTweets: (accountID: number, isFirstRun: boolean): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParseTweets', accountID, isFirstRun)
        },
        indexParseDMConversations: (accountID: number, isFirstRun: boolean): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParseDMConversations', accountID, isFirstRun)
        },
        indexDMsStart: (accountID: number, isFirstRun: boolean): Promise<XIndexDMsStartResponse> => {
            return ipcRenderer.invoke('X:indexDMsStart', accountID, isFirstRun);
        },
        indexParseDMs: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParseDMs', accountID)
        },
        indexTweetsFinished: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexTweetsFinished', accountID)
        },
        indexDMConversationsFinished: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexDMConversationsFinished', accountID)
        },
        indexDMsFinished: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexDMsFinished', accountID)
        },
        indexDMConversationFinished: (accountID: number, conversationID: string): Promise<boolean> => {
            return ipcRenderer.invoke('X:indexDMConversationFinished', accountID, conversationID)
        },
        indexLikesFinished: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexLikesFinished', accountID)
        },
        archiveTweetsStart: (accountID: number): Promise<XArchiveStartResponse | null> => {
            return ipcRenderer.invoke('X:archiveTweetsStart', accountID)
        },
        archiveTweet: (accountID: number, tweetID: string): Promise<boolean> => {
            return ipcRenderer.invoke('X:archiveTweet', accountID, tweetID)
        },
        archiveBuild: (accountID: number): Promise<boolean> => {
            return ipcRenderer.invoke('X:archiveBuild', accountID)
        },
        openFolder: (accountID: number, folderName: string) => {
            ipcRenderer.invoke('X:openFolder', accountID, folderName);
        },
        isRateLimited: (accountID: number, webContentsID: number, url: string): Promise<XIsRateLimitedResponse> => {
            return ipcRenderer.invoke('X:isRateLimited', accountID, webContentsID, url);
        }
    }
})