export const stubElectron = () => {
    return {
        checkForUpdates: cy.stub(),
        getVersion: cy.stub().resolves('0.0.1'),
        getMode: cy.stub().resolves('prod'),
        getPlatform: cy.stub().resolves('win32'),
        getAPIURL: cy.stub().resolves('https://api.example.com'),
        getDashURL: cy.stub().resolves('https://dash.example.com'),
        trackEvent: cy.stub().resolves('tracked'),
        shouldOpenDevtools: cy.stub().resolves(false),
        showMessage: cy.stub(),
        showError: cy.stub(),
        showQuestion: cy.stub(),
        showOpenDialog: cy.stub(),
        openURL: cy.stub(),
        loadFileInWebview: cy.stub(),
        getAccountDataPath: cy.stub().resolves(null),
        startPowerSaveBlocker: cy.stub().resolves(1),
        stopPowerSaveBlocker: cy.stub(),
        deleteSettingsAndRestart: cy.stub(),
        database: {
            getConfig: cy.stub().resolves(null),
            setConfig: cy.stub(),
            getErrorReport: cy.stub().resolves(null),
            getNewErrorReports: cy.stub().resolves([]),
            createErrorReport: cy.stub().resolves(),
            updateErrorReportSubmitted: cy.stub(),
            dismissNewErrorReports: cy.stub(),
            getAccount: cy.stub().resolves(null),
            getAccounts: cy.stub().resolves([]),
            createAccount: cy.stub().resolves({ id: 1, type: 'X', sortOrder: 0, xAccount: null, blueskyAccount: null, uuid: 'uuid' }),
            selectAccountType: cy.stub().resolves({ id: 1, type: 'X', sortOrder: 0, xAccount: null, blueskyAccount: null, uuid: 'uuid' }),
            saveAccount: cy.stub(),
            deleteAccount: cy.stub(),
        },
        archive: {
            isPageAlreadySaved: cy.stub().resolves(false),
            savePage: cy.stub().resolves(false),
        },
        X: {
            resetProgress: cy.stub().resolves({}),
            createJobs: cy.stub().resolves([]),
            getLastFinishedJob: cy.stub().resolves(null),
            updateJob: cy.stub(),
            indexStart: cy.stub(),
            indexStop: cy.stub(),
            indexParseAllJSON: cy.stub().resolves({}),
            indexParseTweets: cy.stub().resolves({}),
            indexParseConversations: cy.stub().resolves({}),
            indexIsThereMore: cy.stub().resolves(false),
            resetThereIsMore: cy.stub().resolves(),
            indexMessagesStart: cy.stub().resolves({}),
            indexParseMessages: cy.stub().resolves({}),
            indexConversationFinished: cy.stub().resolves(),
            archiveTweetsStart: cy.stub().resolves({}),
            archiveTweetsOutputPath: cy.stub().resolves(''),
            archiveTweet: cy.stub().resolves(),
            archiveTweetCheckDate: cy.stub().resolves(),
            archiveBuild: cy.stub().resolves(),
            syncProgress: cy.stub(),
            openFolder: cy.stub(),
            getArchiveInfo: cy.stub().resolves({}),
            resetRateLimitInfo: cy.stub().resolves(),
            isRateLimited: cy.stub().resolves({}),
            getProgress: cy.stub().resolves({}),
            getProgressInfo: cy.stub().resolves({}),
            getDatabaseStats: cy.stub().resolves({}),
            getDeleteReviewStats: cy.stub().resolves({}),
            saveProfileImage: cy.stub().resolves(),
            getLatestResponseData: cy.stub().resolves(null),
            deleteTweetsStart: cy.stub().resolves({}),
            deleteTweetsCountNotArchived: cy.stub().resolves(0),
            deleteRetweetsStart: cy.stub().resolves({}),
            deleteLikesStart: cy.stub().resolves({}),
            deleteBookmarksStart: cy.stub().resolves({}),
            deleteTweet: cy.stub().resolves(),
            deleteDMsMarkAllDeleted: cy.stub().resolves(),
            deleteDMsScrollToBottom: cy.stub().resolves(),
            unzipXArchive: cy.stub().resolves(null),
            deleteUnzippedXArchive: cy.stub().resolves(null),
            verifyXArchive: cy.stub().resolves(null),
            importXArchive: cy.stub().resolves({}),
            getCookie: cy.stub().resolves(null),
            getConfig: cy.stub().resolves(null),
            setConfig: cy.stub(),
        },
        onPowerMonitorSuspend: cy.stub(),
        onPowerMonitorResume: cy.stub(),
    };
};