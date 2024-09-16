import fs from 'fs';
import path from 'path';
import os from 'os';
import * as database from '../../database';

export const stubElectron = () => {
    return {
        getAPIURL: cy.stub(),
        getDashURL: cy.stub(),
        trackEvent: cy.stub(),
        shouldOpenDevtools: cy.stub(),
        showMessage: cy.stub(),
        showError: cy.stub(),
        showQuestion: cy.stub(),
        openURL: cy.stub(),
        loadFileInWebview: cy.stub(),
        getAccountDataPath: cy.stub(),
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
            getUsername: cy.stub(),
            indexStart: cy.stub(),
            indexStop: cy.stub(),
            indexParseTweets: cy.stub(),
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
            archiveTweet: cy.stub(),
            archiveTweetCheckDate: cy.stub(),
            archiveBuild: cy.stub(),
            syncProgress: cy.stub(),
            openFolder: cy.stub(),
            resetRateLimitInfo: cy.stub(),
            isRateLimited: cy.stub(),
            getProgressInfo: cy.stub(),
            saveProfileImage: cy.stub(),
        }
    };
}

export const initTestEnvironment = () => {
    process.env.TEST_MODE = "1";
    process.env.TEST_SETTINGS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), 'test-settings-'));
    process.env.TEST_DATA_PATH = fs.mkdtempSync(path.join(os.tmpdir(), 'test-data-'));

    database.runMainMigrations();
}

export const cleanupTestEnvironment = () => {
    if (process.env.TEST_SETTINGS_PATH) {
        fs.rmdirSync(process.env.TEST_SETTINGS_PATH, { recursive: true });
    }
    if (process.env.TEST_DATA_PATH) {
        fs.rmdirSync(process.env.TEST_DATA_PATH, { recursive: true });
    }
}
