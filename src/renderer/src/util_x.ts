import CydAPIClient from '../../cyd-api-client';
import type { DeviceInfo } from './types';
import { XAccount, XProgressInfo } from '../../shared_types';

export async function xGetLastImportArchive(accountID: number): Promise<Date | null> {
    const lastFinishedJob_importArchive = await window.electron.X.getConfig(accountID, 'lastFinishedJob_importArchive');
    if (lastFinishedJob_importArchive) {
        return new Date(lastFinishedJob_importArchive);
    }
    return null;
}

export async function xGetLastBuildDatabase(accountID: number): Promise<Date | null> {
    const lastFinishedJob_indexTweets = await window.electron.X.getConfig(accountID, 'lastFinishedJob_indexTweets');
    const lastFinishedJob_indexLikes = await window.electron.X.getConfig(accountID, 'lastFinishedJob_indexLikes');
    if (lastFinishedJob_indexTweets || lastFinishedJob_indexLikes) {
        const lastFinishedJob_indexTweets_date = lastFinishedJob_indexTweets ? new Date(lastFinishedJob_indexTweets) : new Date(0);
        const lastFinishedJob_indexLikes_date = lastFinishedJob_indexLikes ? new Date(lastFinishedJob_indexLikes) : new Date(0);
        return lastFinishedJob_indexTweets_date > lastFinishedJob_indexLikes_date ? lastFinishedJob_indexTweets_date : lastFinishedJob_indexLikes_date;
    }
    return null;
}

export async function xHasSomeData(accountID: number): Promise<boolean> {
    const lastImportArchive: Date | null = await xGetLastImportArchive(accountID);
    const lastBuildDatabase: Date | null = await xGetLastBuildDatabase(accountID);
    return lastImportArchive !== null || lastBuildDatabase !== null;
}

export async function xRequiresPremium(xAccount: XAccount): Promise<boolean> {
    let requiresPremium = false;

    // All premium features are part of deleting
    if (!xAccount.deleteMyData) {
        return requiresPremium;
    }

    // You can delete tweets for free, but only if you're not using these options
    if (xAccount.deleteTweets && xAccount.deleteTweetsDaysOldEnabled) {
        console.log('Requires premium: deleteTweets and deleteTweetsDaysOldEnabled');
        requiresPremium = true;
    }
    if (xAccount.deleteTweets && xAccount.deleteTweetsLikesThresholdEnabled) {
        console.log('Requires premium: deleteTweets and deleteTweetsLikesThresholdEnabled');
        requiresPremium = true;
    }
    if (xAccount.deleteTweets && xAccount.deleteTweetsRetweetsThresholdEnabled) {
        console.log('Requires premium: deleteTweets and deleteTweetsRetweetsThresholdEnabled');
        requiresPremium = true;
    }

    // You can delete retweets for free, but only if you're not using these options
    if (xAccount.deleteRetweets && xAccount.deleteRetweetsDaysOldEnabled) {
        console.log('Requires premium: deleteRetweets and deleteRetweetsDaysOldEnabled');
        requiresPremium = true;
    }

    // Deleting likes, bookmarks, DMs, and unfollowing everyone are premium features
    if (xAccount.deleteLikes) {
        console.log('Requires premium: deleteLikes');
        requiresPremium = true;
    }
    if (xAccount.deleteDMs) {
        console.log('Requires premium: deleteDMs');
        requiresPremium = true;
    }
    if (xAccount.deleteBookmarks) {
        console.log('Requires premium: deleteBookmarks');
        requiresPremium = true;
    }
    if (xAccount.unfollowEveryone) {
        console.log('Requires premium: unfollowEveryone');
        requiresPremium = true;
    }

    return requiresPremium;
}

export async function xPostProgress(apiClient: CydAPIClient, deviceInfo: DeviceInfo | null, accountID: number) {
    const progressInfo: XProgressInfo = await window.electron.X.getProgressInfo(accountID);
    const postXProgresResp = await apiClient.postXProgress({
        account_uuid: progressInfo.accountUUID,
        total_tweets_indexed: progressInfo.totalTweetsIndexed,
        total_tweets_archived: progressInfo.totalTweetsArchived,
        total_retweets_indexed: progressInfo.totalRetweetsIndexed,
        total_likes_indexed: progressInfo.totalLikesIndexed,
        total_bookmarks_indexed: progressInfo.totalBookmarksIndexed,
        total_unknown_indexed: progressInfo.totalUnknownIndexed,
        total_tweets_deleted: progressInfo.totalTweetsDeleted,
        total_retweets_deleted: progressInfo.totalRetweetsDeleted,
        total_likes_deleted: progressInfo.totalLikesDeleted,
        total_bookmarks_deleted: progressInfo.totalBookmarksDeleted,
        total_conversations_deleted: progressInfo.totalConversationsDeleted,
        total_accounts_unfollowed: progressInfo.totalAccountsUnfollowed,
        total_tweets_migrated_to_bluesky: progressInfo.totalTweetsMigratedToBluesky,
    }, deviceInfo?.valid ? true : false)
    if (postXProgresResp !== true && postXProgresResp !== false && postXProgresResp.error) {
        // Silently log the error and continue
        console.error("xPostProgress", "failed to post progress to the API", postXProgresResp.message);
    }
}
