export const stubElectron = () => {
    return {
        checkForUpdates: cy.stub(),
        getVersion: cy.stub(),
        getPlatform: cy.stub(),
        getAPIURL: cy.stub(),
        getDashURL: cy.stub(),
        trackEvent: cy.stub(),
        shouldOpenDevtools: cy.stub(),
        showMessage: cy.stub(),
        showError: cy.stub(),
        showQuestion: cy.stub(),
        showSelectFolderDialog: cy.stub(),
        openURL: cy.stub(),
        loadFileInWebview: cy.stub(),
        getAccountDataPath: cy.stub(),
        startPowerSaveBlocker: cy.stub(),
        stopPowerSaveBlocker: cy.stub(),
        deleteSettingsAndRestart: cy.stub(),
        database: {
            getConfig: cy.stub(),
            setConfig: cy.stub(),
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
            getUsernameStart: cy.stub(),
            getUsernameStop: cy.stub(),
            getUsername: cy.stub(),
            indexStart: cy.stub(),
            indexStop: cy.stub(),
            indexParseTweets: cy.stub(),
            indexParseLikes: cy.stub(),
            indexParseConversations: cy.stub(),
            indexIsThereMore: cy.stub(),
            indexMessagesStart: cy.stub(),
            indexParseMessages: cy.stub(),
            indexTweetsFinished: cy.stub(),
            indexConversationsFinished: cy.stub(),
            indexMessagesFinished: cy.stub(),
            indexConversationFinished: cy.stub(),
            indexLikesFinished: cy.stub(),
            archiveTweetsStart: cy.stub(),
            archiveTweetsOutputPath: cy.stub(),
            archiveTweet: cy.stub(),
            archiveTweetCheckDate: cy.stub(),
            archiveBuild: cy.stub(),
            syncProgress: cy.stub(),
            openFolder: cy.stub(),
            resetRateLimitInfo: cy.stub(),
            isRateLimited: cy.stub(),
            getProgress: cy.stub(),
            getProgressInfo: cy.stub(),
            saveProfileImage: cy.stub(),
            getLatestResponseData: cy.stub(),
            deleteTweetsStart: cy.stub(),
            deleteRetweetsStart: cy.stub(),
            deleteLikesStart: cy.stub(),
            deleteTweet: cy.stub(),
            deleteDMsStart: cy.stub(),
            deleteDMsMarkAllDeleted: cy.stub(),
            deleteDMsScrollToBottom: cy.stub(),
            getConfig: cy.stub(),
            setConfig: cy.stub(),
        },
        onPowerMonitorSuspend: cy.stub(),
        onPowerMonitorResume: cy.stub(),
    };
}
