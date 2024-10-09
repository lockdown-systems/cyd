import { contextBridge, ipcRenderer } from 'electron'
import {
    Account,
    XProgress,
    XJob,
    XArchiveStartResponse,
    XIndexMessagesStartResponse,
    XDeleteTweetsStartResponse,
    XRateLimitInfo,
    XProgressInfo,
    ResponseData
} from './shared_types'

contextBridge.exposeInMainWorld('electron', {
    getVersion: (): Promise<string> => {
        return ipcRenderer.invoke('getVersion')
    },
    getPlatform: (): Promise<string> => {
        return ipcRenderer.invoke('getPlatform')
    },
    getAPIURL: (): Promise<string> => {
        return ipcRenderer.invoke('getAPIURL')
    },
    getDashURL: (): Promise<string> => {
        return ipcRenderer.invoke('getDashURL')
    },
    trackEvent: (eventName: string, userAgent: string): Promise<string> => {
        return ipcRenderer.invoke('trackEvent', eventName, userAgent)
    },
    shouldOpenDevtools: (): Promise<boolean> => {
        return ipcRenderer.invoke('shouldOpenDevtools')
    },
    showMessage: (message: string) => {
        ipcRenderer.invoke('showMessage', message)
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
        getConfig: (key: string): Promise<string | null> => {
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
            return ipcRenderer.invoke('database:selectAccountType', accountID, type)
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
        getUsernameStart: (accountID: number) => {
            ipcRenderer.invoke('X:getUsernameStart', accountID)
        },
        getUsernameStop: (accountID: number) => {
            ipcRenderer.invoke('X:getUsernameStop', accountID)
        },
        getUsername: (accountID: number): Promise<string | null> => {
            return ipcRenderer.invoke('X:getUsername', accountID)
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
        indexParseLikes: (accountID: number, isFirstRun: boolean): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParseLikes', accountID, isFirstRun)
        },
        indexParseConversations: (accountID: number, isFirstRun: boolean): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParseConversations', accountID, isFirstRun)
        },
        indexIsThereMore: (accountID: number): Promise<boolean> => {
            return ipcRenderer.invoke('X:indexIsThereMore', accountID)
        },
        indexMessagesStart: (accountID: number, isFirstRun: boolean): Promise<XIndexMessagesStartResponse> => {
            return ipcRenderer.invoke('X:indexMessagesStart', accountID, isFirstRun);
        },
        indexParseMessages: (accountID: number, isFirstRun: boolean): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParseMessages', accountID, isFirstRun)
        },
        indexTweetsFinished: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexTweetsFinished', accountID)
        },
        indexConversationsFinished: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexConversationsFinished', accountID)
        },
        indexMessagesFinished: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexMessagesFinished', accountID)
        },
        indexConversationFinished: (accountID: number, conversationID: string): Promise<boolean> => {
            return ipcRenderer.invoke('X:indexConversationFinished', accountID, conversationID)
        },
        indexLikesFinished: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexLikesFinished', accountID)
        },
        archiveTweetsStart: (accountID: number): Promise<XArchiveStartResponse> => {
            return ipcRenderer.invoke('X:archiveTweetsStart', accountID)
        },
        archiveTweet: (accountID: number, tweetID: string): Promise<boolean> => {
            return ipcRenderer.invoke('X:archiveTweet', accountID, tweetID)
        },
        archiveTweetCheckDate: (accountID: number, tweetID: string): Promise<boolean> => {
            return ipcRenderer.invoke('X:archiveTweetCheckDate', accountID, tweetID)
        },
        archiveBuild: (accountID: number): Promise<boolean> => {
            return ipcRenderer.invoke('X:archiveBuild', accountID)
        },
        syncProgress: (accountID: number, progressJSON: string) => {
            ipcRenderer.invoke('X:syncProgress', accountID, progressJSON)
        },
        openFolder: (accountID: number, folderName: string) => {
            ipcRenderer.invoke('X:openFolder', accountID, folderName);
        },
        resetRateLimitInfo: (accountID: number): Promise<void> => {
            return ipcRenderer.invoke('X:resetRateLimitInfo', accountID);
        },
        isRateLimited: (accountID: number): Promise<XRateLimitInfo> => {
            return ipcRenderer.invoke('X:isRateLimited', accountID);
        },
        getProgress: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:getProgress', accountID);
        },
        getProgressInfo: (accountID: number): Promise<XProgressInfo> => {
            return ipcRenderer.invoke('X:getProgressInfo', accountID);
        },
        saveProfileImage: (accountID: number, url: string): Promise<void> => {
            return ipcRenderer.invoke('X:saveProfileImage', accountID, url);
        },
        getLatestResponseData: (accountID: number): Promise<ResponseData | null> => {
            return ipcRenderer.invoke('X:getLatestResponseData', accountID);
        },
        deleteTweetsStart: (accountID: number): Promise<XDeleteTweetsStartResponse> => {
            return ipcRenderer.invoke('X:deleteTweetsStart', accountID);
        },
        deleteRetweetsStart: (accountID: number): Promise<XDeleteTweetsStartResponse> => {
            return ipcRenderer.invoke('X:deleteRetweetsStart', accountID);
        },
        deleteLikesStart: (accountID: number): Promise<XDeleteTweetsStartResponse> => {
            return ipcRenderer.invoke('X:deleteLikesStart', accountID);
        },
        deleteTweet: (accountID: number, tweetID: string): Promise<boolean> => {
            return ipcRenderer.invoke('X:deleteTweet', accountID, tweetID);
        },
        deleteDMsStart: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:deleteDMsStart', accountID);
        },
        deleteDMsScrollToBottom: (accountID: number): Promise<void> => {
            return ipcRenderer.invoke('X:deleteDMsScrollToBottom', accountID);
        }
    }
})