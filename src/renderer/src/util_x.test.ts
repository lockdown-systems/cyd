import { test, expect } from 'vitest';
import { XAccount } from '../../shared_types';

import * as UtilX from './util_x';

function createXAccountFromDefaults(changes: object) {
    return {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
        username: 'test',
        userID: '',
        profileImageDataURI: '',
        importFromArchive: false,
        saveMyData: false,
        deleteMyData: false,
        archiveMyData: false,
        archiveTweets: false,
        archiveTweetsHTML: false,
        archiveLikes: false,
        archiveBookmarks: false,
        archiveDMs: false,
        deleteTweets: false,
        deleteTweetsDaysOldEnabled: false,
        deleteTweetsDaysOld: 0,
        deleteTweetsLikesThresholdEnabled: false,
        deleteTweetsLikesThreshold: 0,
        deleteTweetsRetweetsThresholdEnabled: false,
        deleteTweetsRetweetsThreshold: 0,
        deleteRetweets: false,
        deleteRetweetsDaysOldEnabled: false,
        deleteRetweetsDaysOld: 0,
        deleteLikes: false,
        deleteBookmarks: false,
        deleteDMs: false,
        unfollowEveryone: false,
        followingCount: 0,
        followersCount: 0,
        tweetsCount: 0,
        likesCount: 0,
        ...changes
    }
}

test('UtilX.xRequiresPremium() returns false when saving', async () => {
    const xAccount: XAccount = createXAccountFromDefaults({
        // saveMyData is true, archive and delete are false
        deleteMyData: false,
        saveMyData: true,
        archiveMyData: false,
        // Save everything
        archiveTweets: true,
        archiveTweetsHTML: true,
        archiveLikes: true,
        archiveBookmarks: true,
        archiveDMs: true,
    })
    expect(await UtilX.xRequiresPremium(xAccount)).toBe(false);
})

test('UtilX.xRequiresPremium() returns false when archiving', async () => {
    const xAccount: XAccount = createXAccountFromDefaults({
        // archiveMyData is true, save and delete are false
        deleteMyData: false,
        saveMyData: false,
        archiveMyData: true,
        // Save everything
        archiveTweetsHTML: true,
        archiveBookmarks: true,
        archiveDMs: true,
    })
    expect(await UtilX.xRequiresPremium(xAccount)).toBe(false);
})

test('UtilX.xRequiresPremium() returns false for only deleting tweets and retweets', async () => {
    const xAccount: XAccount = createXAccountFromDefaults({
        // deleteMyData is true, save and archive are false
        deleteMyData: true,
        saveMyData: false,
        archiveMyData: false,
        // Only delete tweets and retweets, no other settings
        deleteTweets: true,
        deleteRetweets: true,
        deleteTweetsDaysOldEnabled: false,
        deleteTweetsLikesThresholdEnabled: false,
        deleteTweetsRetweetsThresholdEnabled: false,
        deleteRetweetsDaysOldEnabled: false,
        deleteLikes: false,
        deleteBookmarks: false,
        deleteDMs: false,
        unfollowEveryone: false
    })
    expect(await UtilX.xRequiresPremium(xAccount)).toBe(false);
})

test('UtilX.xRequiresPremium() returns true when choosing any delete options', async () => {
    const deleteOptions = ['deleteTweetsDaysOldEnabled', 'deleteTweetsLikesThresholdEnabled', 'deleteTweetsRetweetsThresholdEnabled', 'deleteRetweetsDaysOldEnabled', 'deleteLikes', 'deleteBookmarks', 'deleteDMs', 'unfollowEveryone'];
    for (const option of deleteOptions) {
        const xAccount: XAccount = createXAccountFromDefaults({
            // deleteMyData is true, save and archive are false
            deleteMyData: true,
            saveMyData: false,
            archiveMyData: false,
            // delete tweets and retweets
            deleteTweets: true,
            deleteRetweets: true,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (xAccount as any)[option] = true;

        // Check if the account requires premium
        const requiresPremium = await UtilX.xRequiresPremium(xAccount);
        console.log(`option: ${option}, requiresPremium: ${requiresPremium}`);
        expect(requiresPremium).toBe(true);
    }
})