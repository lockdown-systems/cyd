import { ipcMain } from 'electron'

import { XAccountController } from './x_account_controller';

import {
    XAccount,
    XJob,
    XProgress,
    XArchiveStartResponse,
    XRateLimitInfo,
    XIndexMessagesStartResponse,
    XDeleteTweetsStartResponse,
    XProgressInfo,
    ResponseData,
    XDatabaseStats,
    XDeleteReviewStats,
    XImportArchiveResponse,
    BlueskyMigrationProfile,
    XMigrateTweetCounts,
} from '../shared_types'
import { getMITMController } from '../mitm';
import { packageExceptionForReport } from '../util'

const controllers: Record<number, XAccountController> = {};

const getXAccountController = (accountID: number): XAccountController => {
    if (!controllers[accountID]) {
        controllers[accountID] = new XAccountController(accountID, getMITMController(accountID));
    }
    controllers[accountID].refreshAccount();
    return controllers[accountID];
}

export const defineIPCX = () => {
    ipcMain.handle('X:resetProgress', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return controller.resetProgress();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:createJobs', async (_, accountID: number, jobTypes: string[]): Promise<XJob[]> => {
        try {
            const controller = getXAccountController(accountID);
            return controller.createJobs(jobTypes);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getLastFinishedJob', async (_, accountID: number, jobType: string): Promise<XJob | null> => {
        try {
            const controller = getXAccountController(accountID);
            return controller.getLastFinishedJob(jobType);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:updateJob', async (_, accountID: number, jobJSON: string) => {
        try {
            const controller = getXAccountController(accountID);
            const job = JSON.parse(jobJSON) as XJob;
            controller.updateJob(job);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexStart', async (_, accountID: number) => {
        try {
            const controller = getXAccountController(accountID);
            await controller.indexStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexStop', async (_, accountID: number) => {
        try {
            const controller = getXAccountController(accountID);
            await controller.indexStop();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexParseAllJSON', async (_, accountID: number): Promise<XAccount> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexParseAllJSON();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexParseTweets', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexParseTweets();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexParseConversations', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexParseConversations();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexIsThereMore', async (_, accountID: number): Promise<boolean> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexIsThereMore();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:resetThereIsMore', async (_, accountID: number): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.resetThereIsMore();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexMessagesStart', async (_, accountID: number): Promise<XIndexMessagesStartResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexMessagesStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexParseMessages', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexParseMessages();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexConversationFinished', async (_, accountID: number, conversationID: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.indexConversationFinished(conversationID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:archiveTweetsStart', async (_, accountID: number): Promise<XArchiveStartResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.archiveTweetsStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:archiveTweetsOutputPath', async (_, accountID: number): Promise<string> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.archiveTweetsOutputPath();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:archiveTweet', async (_, accountID: number, tweetID: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.archiveTweet(tweetID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:archiveTweetCheckDate', async (_, accountID: number, tweetID: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.archiveTweetCheckDate(tweetID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:archiveBuild', async (_, accountID: number): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.archiveBuild();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:syncProgress', async (_, accountID: number, progressJSON: string) => {
        try {
            const controller = getXAccountController(accountID);
            await controller.syncProgress(progressJSON);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:resetRateLimitInfo', async (_, accountID: number): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.resetRateLimitInfo();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:isRateLimited', async (_, accountID: number): Promise<XRateLimitInfo> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.isRateLimited();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getProgress', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getProgress();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getProgressInfo', async (_, accountID: number): Promise<XProgressInfo> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getProgressInfo();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getDatabaseStats', async (_, accountID: number): Promise<XDatabaseStats> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getDatabaseStats();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getDeleteReviewStats', async (_, accountID: number): Promise<XDeleteReviewStats> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getDeleteReviewStats();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:saveProfileImage', async (_, accountID: number, url: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.saveProfileImage(url);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getLatestResponseData', async (_, accountID: number): Promise<ResponseData | null> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getLatestResponseData();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteTweetsStart', async (_, accountID: number): Promise<XDeleteTweetsStartResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.deleteTweetsStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteTweetsCountNotArchived', async (_, accountID: number, total: boolean): Promise<number> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.deleteTweetsCountNotArchived(total);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteRetweetsStart', async (_, accountID: number): Promise<XDeleteTweetsStartResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.deleteRetweetsStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteLikesStart', async (_, accountID: number): Promise<XDeleteTweetsStartResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.deleteLikesStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteBookmarksStart', async (_, accountID: number): Promise<XDeleteTweetsStartResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.deleteBookmarksStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteTweet', async (_, accountID: number, tweetID: string, deleteType: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.deleteTweet(tweetID, deleteType);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteDMsMarkAllDeleted', async (_, accountID: number): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.deleteDMsMarkAllDeleted();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:unzipXArchive', async (_, accountID: number, archivePath: string): Promise<string | null> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.unzipXArchive(archivePath);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteUnzippedXArchive', async (_, accountID: number, archivePath: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.deleteUnzippedXArchive(archivePath);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:verifyXArchive', async (_, accountID: number, archivePath: string): Promise<string | null> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.verifyXArchive(archivePath);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:importXArchive', async (_, accountID: number, archivePath: string, dataType: string): Promise<XImportArchiveResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.importXArchive(archivePath, dataType);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getCookie', async (_, accountID: number, hostname: string, name: string): Promise<string | null> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getCookie(hostname, name);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getConfig', async (_, accountID: number, key: string): Promise<string | null> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getConfig(key);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:setConfig', async (_, accountID: number, key: string, value: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.setConfig(key, value);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteConfig', async (_, accountID: number, key: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.deleteConfig(key);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteConfigLike', async (_, accountID: number, key: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.deleteConfigLike(key);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getImageDataURI', async (_, accountID: number, url: string): Promise<string> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getImageDataURI(url);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:blueskyGetProfile', async (_, accountID: number): Promise<BlueskyMigrationProfile | null> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.blueskyGetProfile();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:blueskyAuthorize', async (_, accountID: number, handle: string): Promise<boolean | string> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.blueskyAuthorize(handle);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:blueskyCallback', async (_, accountID: number, queryString: string): Promise<boolean | string> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.blueskyCallback(queryString);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:blueskyDisconnect', async (_, accountID: number): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.blueskyDisconnect();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:blueskyGetTweetCounts', async (_, accountID: number): Promise<XMigrateTweetCounts> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.blueskyGetTweetCounts();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:blueskyMigrateTweet', async (_, accountID: number, tweetID: string): Promise<boolean | string> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.blueskyMigrateTweet(tweetID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:blueskyDeleteMigratedTweet', async (_, accountID: number, tweetID: string): Promise<boolean> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.blueskyDeleteMigratedTweet(tweetID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });
};
