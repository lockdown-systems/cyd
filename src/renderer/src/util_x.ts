import { XAccount, XArchiveStartResponse } from '../../shared_types';

export async function xHasSomeData(accountID: number): Promise<boolean> {
    let lastImportArchive: Date | null = null;
    let lastBuildDatabase: Date | null = null;

    const lastFinishedJob_importArchive = await window.electron.X.getConfig(accountID, 'lastFinishedJob_importArchive');
    if (lastFinishedJob_importArchive) {
        lastImportArchive = new Date(lastFinishedJob_importArchive);
    }

    const lastFinishedJob_indexTweets = await window.electron.X.getConfig(accountID, 'lastFinishedJob_indexTweets');
    const lastFinishedJob_indexLikes = await window.electron.X.getConfig(accountID, 'lastFinishedJob_indexLikes');
    if (lastFinishedJob_indexTweets || lastFinishedJob_indexLikes) {
        const lastFinishedJob_indexTweets_date = lastFinishedJob_indexTweets ? new Date(lastFinishedJob_indexTweets) : new Date(0);
        const lastFinishedJob_indexLikes_date = lastFinishedJob_indexLikes ? new Date(lastFinishedJob_indexLikes) : new Date(0);
        lastBuildDatabase = lastFinishedJob_indexTweets_date > lastFinishedJob_indexLikes_date ? lastFinishedJob_indexTweets_date : lastFinishedJob_indexLikes_date;
    }

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

    // Deleting likes, DMs, and unfollowing everyone are premium features
    if (xAccount.deleteLikes) {
        console.log('Requires premium: deleteLikes');
        requiresPremium = true;
    }
    if (xAccount.deleteDMs) {
        console.log('Requires premium: deleteDMs');
        requiresPremium = true;
    }
    if (xAccount.unfollowEveryone) {
        console.log('Requires premium: unfollowEveryone');
        requiresPremium = true;
    }

    return requiresPremium;
}

export async function xGetUnarchivedTweetsCount(accountID: number): Promise<number> {
    let archivedTweetsCount = 0;
    const archiveStartResponse: XArchiveStartResponse = await window.electron.X.archiveTweetsStart(accountID);
    for (let i = 0; i < archiveStartResponse.items.length; i++) {
        if (await window.electron.archive.isPageAlreadySaved(archiveStartResponse.outputPath, archiveStartResponse.items[i].basename)) {
            archivedTweetsCount++;
        }
    }
    return archiveStartResponse.items.length - archivedTweetsCount;
}