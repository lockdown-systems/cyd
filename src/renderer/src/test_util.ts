export const stubElectron = () => {
    return {
        checkForUpdates: cy.stub(),
        getVersion: cy.stub(),
        getMode: cy.stub(),
        getPlatform: cy.stub(),
        getAPIURL: cy.stub(),
        getDashURL: cy.stub(),
        trackEvent: cy.stub(),
        shouldOpenDevtools: cy.stub(),
        showMessage: cy.stub(),
        showError: cy.stub(),
        showQuestion: cy.stub(),
        showOpenDialog: cy.stub(),
        openURL: cy.stub(),
        loadFileInWebview: cy.stub(),
        getAccountDataPath: cy.stub(),
        startPowerSaveBlocker: cy.stub(),
        stopPowerSaveBlocker: cy.stub(),
        deleteSettingsAndRestart: cy.stub(),
        database: {
            getConfig: cy.stub(),
            setConfig: cy.stub(),
            getErrorReport: cy.stub(),
            getNewErrorReports: cy.stub(),
            createErrorReport: cy.stub(),
            updateErrorReportSubmitted: cy.stub(),
            dismissNewErrorReports: cy.stub(),
            getAccount: cy.stub(),
            getAccounts: cy.stub(),
            createAccount: cy.stub(),
            selectAccountType: cy.stub(),
            saveAccount: cy.stub(),
            deleteAccount: cy.stub(),
        },
        archive: {
            isPageAlreadySaved: cy.stub(),
            savePage: cy.stub(),
        },
        X: {
            resetProgress: cy.stub(),
            createJobs: cy.stub(),
            getLastFinishedJob: cy.stub(),
            updateJob: cy.stub(),
            indexStart: cy.stub(),
            indexStop: cy.stub(),
            indexParseAllJSON: cy.stub(),
            indexParseTweets: cy.stub(),
            indexParseConversations: cy.stub(),
            indexIsThereMore: cy.stub(),
            resetThereIsMore: cy.stub(),
            indexMessagesStart: cy.stub(),
            indexParseMessages: cy.stub(),
            indexConversationFinished: cy.stub(),
            archiveTweetsStart: cy.stub(),
            archiveTweetsOutputPath: cy.stub(),
            archiveTweet: cy.stub(),
            archiveTweetCheckDate: cy.stub(),
            archiveBuild: cy.stub(),
            syncProgress: cy.stub(),
            openFolder: cy.stub(),
            getArchiveInfo: cy.stub(),
            resetRateLimitInfo: cy.stub(),
            isRateLimited: cy.stub(),
            getProgress: cy.stub(),
            getProgressInfo: cy.stub(),
            getDatabaseStats: cy.stub(),
            getDeleteReviewStats: cy.stub(),
            saveProfileImage: cy.stub(),
            getLatestResponseData: cy.stub(),
            deleteTweetsStart: cy.stub(),
            deleteTweetsCountNotArchived: cy.stub(),
            deleteRetweetsStart: cy.stub(),
            deleteLikesStart: cy.stub(),
            deleteBookmarksStart: cy.stub(),
            deleteTweet: cy.stub(),
            deleteDMsMarkAllDeleted: cy.stub(),
            deleteDMsScrollToBottom: cy.stub(),
            verifyXArchive: cy.stub(),
            importXArchive: cy.stub(),
            getConfig: cy.stub(),
            setConfig: cy.stub(),
        },
        onPowerMonitorSuspend: cy.stub(),
        onPowerMonitorResume: cy.stub(),
    };
}
