import { contextBridge, ipcRenderer, FileFilter } from 'electron'
import {
    ErrorReport,
    Account,
    ResponseData,
    // X
    XJob,
    XProgress,
    XArchiveStartResponse,
    XIndexMessagesStartResponse,
    XDeleteTweetsStartResponse,
    XRateLimitInfo,
    XProgressInfo,
    XDatabaseStats,
    XDeleteReviewStats,
    XArchiveInfo,
    XAccount,
    XImportArchiveResponse,
    // Facebook
    FacebookJob,
    FacebookProgress,
} from './shared_types'

contextBridge.exposeInMainWorld('electron', {
    checkForUpdates: () => {
        ipcRenderer.invoke('checkForUpdates')
    },
    getVersion: (): Promise<string> => {
        return ipcRenderer.invoke('getVersion')
    },
    getMode: (): Promise<string> => {
        return ipcRenderer.invoke('getMode')
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
    showMessage: (message: string, detail: string) => {
        ipcRenderer.invoke('showMessage', message, detail)
    },
    showError: (message: string) => {
        ipcRenderer.invoke('showError', message)
    },
    showQuestion: (message: string, trueText: string, falseText: string): Promise<boolean> => {
        return ipcRenderer.invoke('showQuestion', message, trueText, falseText)
    },
    showOpenDialog: (selectFolders: boolean, selectFiles: boolean, fileFilters: FileFilter[] | undefined = undefined): Promise<string | null> => {
        return ipcRenderer.invoke('showOpenDialog', selectFolders, selectFiles, fileFilters)
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
    startPowerSaveBlocker: (accountID: number): Promise<number> => {
        return ipcRenderer.invoke('startPowerSaveBlocker', accountID)
    },
    stopPowerSaveBlocker: (accountID: number, powerSaveBlockerID: number) => {
        ipcRenderer.invoke('stopPowerSaveBlocker', accountID, powerSaveBlockerID)
    },
    deleteSettingsAndRestart: () => {
        ipcRenderer.invoke('deleteSettingsAndRestart')
    },
    database: {
        getConfig: (key: string): Promise<string | null> => {
            return ipcRenderer.invoke('database:getConfig', key);
        },
        setConfig: (key: string, value: string) => {
            ipcRenderer.invoke('database:setConfig', key, value)
        },
        getErrorReport: (id: number): Promise<ErrorReport | null> => {
            return ipcRenderer.invoke('database:getErrorReport', id)
        },
        getNewErrorReports: (accountID: number): Promise<ErrorReport[]> => {
            return ipcRenderer.invoke('database:getNewErrorReports', accountID)
        },
        createErrorReport: (accountID: number, accountType: string, errorReportType: string, errorReportData: string, accountUsername: string | null, screenshotDataURI: string | null, sensitiveContextData: string | null): Promise<void> => {
            return ipcRenderer.invoke('database:createErrorReport', accountID, accountType, errorReportType, errorReportData, accountUsername, screenshotDataURI, sensitiveContextData)
        },
        updateErrorReportSubmitted: (id: number) => {
            ipcRenderer.invoke('database:updateErrorReportSubmitted', id)
        },
        dismissNewErrorReports: (accountID: number) => {
            ipcRenderer.invoke('database:dismissNewErrorReports', accountID)
        },
        getAccount: (accountID: number): Promise<Account | null> => {
            return ipcRenderer.invoke('database:getAccount', accountID)
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
        indexStart: (accountID: number) => {
            ipcRenderer.invoke('X:indexStart', accountID)
        },
        indexStop: (accountID: number) => {
            ipcRenderer.invoke('X:indexStop', accountID)
        },
        indexParseAllJSON: (accountID: number): Promise<XAccount> => {
            return ipcRenderer.invoke('X:indexParseAllJSON', accountID)
        },
        indexParseTweets: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParseTweets', accountID)
        },
        indexParseLikes: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParseLikes', accountID)
        },
        indexParseBookmarks: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParseBookmarks', accountID)
        },
        indexParseConversations: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParseConversations', accountID)
        },
        indexIsThereMore: (accountID: number): Promise<boolean> => {
            return ipcRenderer.invoke('X:indexIsThereMore', accountID)
        },
        resetThereIsMore: (accountID: number) => {
            ipcRenderer.invoke('X:resetThereIsMore', accountID)
        },
        indexMessagesStart: (accountID: number): Promise<XIndexMessagesStartResponse> => {
            return ipcRenderer.invoke('X:indexMessagesStart', accountID);
        },
        indexParseMessages: (accountID: number): Promise<XProgress> => {
            return ipcRenderer.invoke('X:indexParseMessages', accountID)
        },
        indexConversationFinished: (accountID: number, conversationID: string): Promise<void> => {
            return ipcRenderer.invoke('X:indexConversationFinished', accountID, conversationID)
        },
        archiveTweetsStart: (accountID: number): Promise<XArchiveStartResponse> => {
            return ipcRenderer.invoke('X:archiveTweetsStart', accountID)
        },
        archiveTweetsOutputPath: (accountID: number): Promise<string> => {
            return ipcRenderer.invoke('X:archiveTweetsOutputPath', accountID)
        },
        archiveTweet: (accountID: number, tweetID: string): Promise<void> => {
            return ipcRenderer.invoke('X:archiveTweet', accountID, tweetID)
        },
        archiveTweetCheckDate: (accountID: number, tweetID: string): Promise<void> => {
            return ipcRenderer.invoke('X:archiveTweetCheckDate', accountID, tweetID)
        },
        archiveBuild: (accountID: number): Promise<void> => {
            return ipcRenderer.invoke('X:archiveBuild', accountID)
        },
        syncProgress: (accountID: number, progressJSON: string) => {
            ipcRenderer.invoke('X:syncProgress', accountID, progressJSON)
        },
        openFolder: (accountID: number, folderName: string) => {
            ipcRenderer.invoke('X:openFolder', accountID, folderName);
        },
        getArchiveInfo: (accountID: number): Promise<XArchiveInfo> => {
            return ipcRenderer.invoke('X:getArchiveInfo', accountID);
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
        getDatabaseStats: (accountID: number): Promise<XDatabaseStats> => {
            return ipcRenderer.invoke('X:getDatabaseStats', accountID);
        },
        getDeleteReviewStats: (accountID: number): Promise<XDeleteReviewStats> => {
            return ipcRenderer.invoke('X:getDeleteReviewStats', accountID);
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
        deleteTweetsCountNotArchived: (accountID: number, total: boolean): Promise<number> => {
            return ipcRenderer.invoke('X:deleteTweetsCountNotArchived', accountID, total);
        },
        deleteRetweetsStart: (accountID: number): Promise<XDeleteTweetsStartResponse> => {
            return ipcRenderer.invoke('X:deleteRetweetsStart', accountID);
        },
        deleteLikesStart: (accountID: number): Promise<XDeleteTweetsStartResponse> => {
            return ipcRenderer.invoke('X:deleteLikesStart', accountID);
        },
        deleteBookmarksStart: (accountID: number): Promise<XDeleteTweetsStartResponse> => {
            return ipcRenderer.invoke('X:deleteBookmarksStart', accountID);
        },
        deleteTweet: (accountID: number, tweetID: string, deleteType: string): Promise<void> => {
            return ipcRenderer.invoke('X:deleteTweet', accountID, tweetID, deleteType);
        },
        deleteDMsMarkAllDeleted: (accountID: number): Promise<void> => {
            return ipcRenderer.invoke('X:deleteDMsMarkAllDeleted', accountID);
        },
        deleteDMsScrollToBottom: (accountID: number): Promise<void> => {
            return ipcRenderer.invoke('X:deleteDMsScrollToBottom', accountID);
        },
        unzipXArchive: (accountID: number, archivePath: string): Promise<string | null> => {
            return ipcRenderer.invoke('X:unzipXArchive', accountID, archivePath);
        },
        deleteUnzippedXArchive: (accountID: number, archivePath: string): Promise<string | null> => {
            return ipcRenderer.invoke('X:deleteUnzippedXArchive', accountID, archivePath);
        },
        verifyXArchive: (accountID: number, archivePath: string): Promise<string | null> => {
            return ipcRenderer.invoke('X:verifyXArchive', accountID, archivePath);
        },
        importXArchive: (accountID: number, archivePath: string, dataType: string): Promise<XImportArchiveResponse> => {
            return ipcRenderer.invoke('X:importXArchive', accountID, archivePath, dataType);
        },
        getCookie: (accountID: number, name: string): Promise<string | null> => {
            return ipcRenderer.invoke('X:getCookie', accountID, name);
        },
        getConfig: (accountID: number, key: string): Promise<string | null> => {
            return ipcRenderer.invoke('X:getConfig', accountID, key);
        },
        setConfig: (accountID: number, key: string, value: string): Promise<void> => {
            return ipcRenderer.invoke('X:setConfig', accountID, key, value);
        }
    },
    Facebook: {
        resetProgress: (accountID: number): Promise<FacebookProgress> => {
            return ipcRenderer.invoke('Facebook:resetProgress', accountID);
        },
        createJobs: (accountID: number, jobTypes: string[]): Promise<FacebookJob[]> => {
            return ipcRenderer.invoke('Facebook:createJobs', accountID, jobTypes);
        },
        updateJob: (accountID: number, jobJSON: string) => {
            ipcRenderer.invoke('Facebook:updateJob', accountID, jobJSON);
        },
        archiveBuild: (accountID: number): Promise<void> => {
            return ipcRenderer.invoke('Facebook:archiveBuild', accountID);
        },
        syncProgress: (accountID: number, progressJSON: string) => {
            ipcRenderer.invoke('Facebook:syncProgress', accountID, progressJSON);
        },
        getProgress: (accountID: number): Promise<FacebookProgress> => {
            return ipcRenderer.invoke('Facebook:getProgress', accountID);
        },
        getCookie: (accountID: number, name: string): Promise<string | null> => {
            return ipcRenderer.invoke('Facebook:getCookie', accountID, name);
        },
        getProfileImageDataURI: (profilePictureURI: string): Promise<string> => {
            return ipcRenderer.invoke('Facebook:getProfileImageDataURI', profilePictureURI);
        },
        getConfig: (accountID: number, key: string): Promise<string | null> => {
            return ipcRenderer.invoke('Facebook:getConfig', accountID, key);
        },
        setConfig: (accountID: number, key: string, value: string): Promise<void> => {
            return ipcRenderer.invoke('Facebook:setConfig', accountID, key, value);
        },
    },
    // Handle events from the main process
    onPowerMonitorSuspend: (callback: () => void) => {
        ipcRenderer.on('powerMonitor:suspend', callback);
    },
    onPowerMonitorResume: (callback: () => void) => {
        ipcRenderer.on('powerMonitor:resume', callback);
    },
})
