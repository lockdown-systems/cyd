import { exec, getMainDatabase, Sqlite3Info } from './common';
import { BlueskyAccount } from '../shared_types'

// Types

export interface BlueskyAccountRow {
    id: number;
    createdAt: string;
    updatedAt: string;
    accessedAt: string;
    username: string;
    profileImageDataURI: string;
    saveMyData: boolean;
    deleteMyData: boolean;
    archivePosts: boolean;
    archivePostsHTML: boolean;
    archiveLikes: boolean;
    deletePosts: boolean;
    deletePostsDaysOldEnabled: boolean;
    deletePostsDaysOld: number;
    deletePostsLikesThresholdEnabled: boolean;
    deletePostsLikesThreshold: number;
    deletePostsRepostsThresholdEnabled: boolean;
    deletePostsRepostsThreshold: number;
    deleteReposts: boolean;
    deleteRepostsDaysOldEnabled: boolean;
    deleteRepostsDaysOld: number;
    deleteLikes: boolean;
    deleteLikesDaysOldEnabled: boolean;
    deleteLikesDaysOld: number;
    followingCount: number;
    followersCount: number;
    postsCount: number;
    likesCount: number;
}

// Functions

// Get a single Bluesky account by ID
export const getBlueskyAccount = (id: number): BlueskyAccount | null => {
    const row: BlueskyAccountRow | undefined = exec(getMainDatabase(), 'SELECT * FROM blueskyAccount WHERE id = ?', [id], 'get') as BlueskyAccountRow | undefined;
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        accessedAt: new Date(row.accessedAt),
        username: row.username,
        profileImageDataURI: row.profileImageDataURI,
        saveMyData: !!row.saveMyData,
        deleteMyData: !!row.deleteMyData,
        archivePosts: !!row.archivePosts,
        archivePostsHTML: !!row.archivePostsHTML,
        archiveLikes: !!row.archiveLikes,
        deletePosts: !!row.deletePosts,
        deletePostsDaysOldEnabled: !!row.deletePostsDaysOldEnabled,
        deletePostsDaysOld: row.deletePostsDaysOld,
        deletePostsLikesThresholdEnabled: !!row.deletePostsLikesThresholdEnabled,
        deletePostsLikesThreshold: row.deletePostsLikesThreshold,
        deletePostsRepostsThresholdEnabled: !!row.deletePostsRepostsThresholdEnabled,
        deletePostsRepostsThreshold: row.deletePostsRepostsThreshold,
        deleteReposts: !!row.deleteReposts,
        deleteRepostsDaysOldEnabled: !!row.deleteRepostsDaysOldEnabled,
        deleteRepostsDaysOld: row.deleteRepostsDaysOld,
        deleteLikes: !!row.deleteLikes,
        deleteLikesDaysOldEnabled: !!row.deleteLikesDaysOldEnabled,
        deleteLikesDaysOld: row.deleteLikesDaysOld,
        followingCount: row.followingCount,
        followersCount: row.followersCount,
        postsCount: row.postsCount,
        likesCount: row.likesCount
    };
}

// Get all Bluesky accounts
export const getBlueskyAccounts = (): BlueskyAccount[] => {
    const rows: BlueskyAccountRow[] = exec(getMainDatabase(), 'SELECT * FROM blueskyAccount', [], 'all') as BlueskyAccountRow[];

    const accounts: BlueskyAccount[] = [];
    for (const row of rows) {
        accounts.push({
            id: row.id,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
            accessedAt: new Date(row.accessedAt),
            username: row.username,
            profileImageDataURI: row.profileImageDataURI,
            saveMyData: !!row.saveMyData,
            deleteMyData: !!row.deleteMyData,
            archivePosts: !!row.archivePosts,
            archivePostsHTML: !!row.archivePostsHTML,
            archiveLikes: !!row.archiveLikes,
            deletePosts: !!row.deletePosts,
            deletePostsDaysOldEnabled: !!row.deletePostsDaysOldEnabled,
            deletePostsDaysOld: row.deletePostsDaysOld,
            deletePostsLikesThresholdEnabled: !!row.deletePostsLikesThresholdEnabled,
            deletePostsLikesThreshold: row.deletePostsLikesThreshold,
            deletePostsRepostsThresholdEnabled: !!row.deletePostsRepostsThresholdEnabled,
            deletePostsRepostsThreshold: row.deletePostsRepostsThreshold,
            deleteReposts: !!row.deleteReposts,
            deleteRepostsDaysOldEnabled: !!row.deleteRepostsDaysOldEnabled,
            deleteRepostsDaysOld: row.deleteRepostsDaysOld,
            deleteLikes: !!row.deleteLikes,
            deleteLikesDaysOldEnabled: !!row.deleteLikesDaysOldEnabled,
            deleteLikesDaysOld: row.deleteLikesDaysOld,
            followingCount: row.followingCount,
            followersCount: row.followersCount,
            postsCount: row.postsCount,
            likesCount: row.likesCount
        });
    }
    return accounts;
}

// Create a new Bluesky account
export const createBlueskyAccount = (): BlueskyAccount => {
    const info: Sqlite3Info = exec(getMainDatabase(), 'INSERT INTO blueskyAccount DEFAULT VALUES') as Sqlite3Info;
    const account = getBlueskyAccount(info.lastInsertRowid);
    if (!account) {
        throw new Error("Failed to create account");
    }
    return account;
}

// Update the Bluesky account based on account.id
export const saveBlueskyAccount = (account: BlueskyAccount) => {
    exec(getMainDatabase(), `
        UPDATE blueskyAccount
        SET
            updatedAt = CURRENT_TIMESTAMP,
            accessedAt = CURRENT_TIMESTAMP,
            username = ?,
            profileImageDataURI = ?,
            saveMyData = ?,
            deleteMyData = ?,
            archivePosts = ?,
            archivePostsHTML = ?,
            archiveLikes = ?,
            deletePosts = ?,
            deletePostsDaysOld = ?,
            deletePostsDaysOldEnabled = ?,
            deletePostsLikesThresholdEnabled = ?,
            deletePostsLikesThreshold = ?,
            deletePostsRepostsThresholdEnabled = ?,
            deletePostsRepostsThreshold = ?,
            deleteReposts = ?,
            deleteRepostsDaysOldEnabled = ?,
            deleteRepostsDaysOld = ?,
            deleteLikes = ?,
            deleteLikesDaysOldEnabled = ?,
            deleteLikesDaysOld = ?,
            followingCount = ?,
            followersCount = ?,
            postsCount = ?,
            likesCount = ?
        WHERE id = ?
    `, [
        account.username,
        account.profileImageDataURI,
        account.saveMyData ? 1 : 0,
        account.deleteMyData ? 1 : 0,
        account.archivePosts ? 1 : 0,
        account.archivePostsHTML ? 1 : 0,
        account.archiveLikes ? 1 : 0,
        account.deletePosts ? 1 : 0,
        account.deletePostsDaysOld,
        account.deletePostsDaysOldEnabled ? 1 : 0,
        account.deletePostsLikesThresholdEnabled ? 1 : 0,
        account.deletePostsLikesThreshold,
        account.deletePostsRepostsThresholdEnabled ? 1 : 0,
        account.deletePostsRepostsThreshold,
        account.deleteReposts ? 1 : 0,
        account.deleteRepostsDaysOldEnabled ? 1 : 0,
        account.deleteRepostsDaysOld,
        account.deleteLikes ? 1 : 0,
        account.deleteLikesDaysOldEnabled ? 1 : 0,
        account.deleteLikesDaysOld,
        account.followingCount,
        account.followersCount,
        account.postsCount,
        account.likesCount,
        account.id
    ]);
}
