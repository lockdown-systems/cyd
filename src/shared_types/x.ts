// X models

export type XJob = {
    id: number | null;
    jobType: string; // "login", "index", "archiveTweets", "archiveDMs", "deleteTweets", "deleteLikes", "deleteDMs", "downloadArchive"
    status: string; // "pending", "running", "finished", "failed", "canceled"
    scheduledAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    progressJSON: string;
    error: string | null;
};

export type XTweet = {
    id: number | null;
    username: string;
    tweetID: string; // id_str
    conversationID: string; // conversation_id_str
    createdAt: Date; // created_at
    likeCount: number; // favorite_count
    quoteCount: number; // quote_count
    replyCount: number; // reply_count
    retweetCount: number; // retweet_count
    isLiked: boolean; // favorited
    isRetweeted: boolean; // retweeted
    text: string; // full_text
    path: string; // "{username}/status/{tweetID}"
    addedToDatabaseAt: Date;
    archivedAt: Date | null;
    deletedAt: Date | null;
};

export interface XUser {
    id: number | null;
    userID: string;
    name: string | null;
    screenName: string;
    profileImageDataURI: string | null;
}

// Other X types

export type XProgress = {
    currentJob: string;

    isIndexTweetsFinished: boolean;
    isIndexConversationsFinished: boolean;
    isIndexMessagesFinished: boolean;
    isIndexLikesFinished: boolean;
    isArchiveTweetsFinished: boolean;
    isArchiveLikesFinished: boolean;
    isIndexBookmarksFinished: boolean;
    isDeleteDMsFinished: boolean;
    isUnfollowEveryoneFinished: boolean;

    tweetsIndexed: number;
    retweetsIndexed: number;
    usersIndexed: number;
    conversationsIndexed: number;
    messagesIndexed: number;
    likesIndexed: number;
    unknownIndexed: number;

    totalTweetsToArchive: number;
    tweetsArchived: number;
    newTweetsArchived: number;

    totalLikesToArchive: number;
    likesArchived: number;

    totalBookmarksToIndex: number;
    bookmarksIndexed: number;

    totalConversations: number;
    conversationMessagesIndexed: number;

    totalTweetsToDelete: number;
    tweetsDeleted: number;

    totalRetweetsToDelete: number;
    retweetsDeleted: number;

    totalLikesToDelete: number;
    likesDeleted: number;

    totalBookmarksToDelete: number;
    bookmarksDeleted: number;

    conversationsDeleted: number;
    accountsUnfollowed: number;

    totalTweetsToMigrate: number;
    migrateTweetsCount: number;
    migrateSkippedTweetsCount: number;
    migrateSkippedTweetsErrors: Record<string, string>;

    totalMigratedPostsToDelete: number;
    migrateDeletePostsCount: number;
    migrateDeleteSkippedPostsCount: number;

    errorsOccured: number;
}

export function emptyXProgress(): XProgress {
    return {
        currentJob: "",

        isIndexTweetsFinished: false,
        isIndexConversationsFinished: false,
        isIndexMessagesFinished: false,
        isIndexLikesFinished: false,
        isArchiveTweetsFinished: false,
        isArchiveLikesFinished: false,
        isIndexBookmarksFinished: false,
        isDeleteDMsFinished: false,
        isUnfollowEveryoneFinished: false,

        tweetsIndexed: 0,
        retweetsIndexed: 0,
        usersIndexed: 0,
        conversationsIndexed: 0,
        messagesIndexed: 0,
        likesIndexed: 0,
        unknownIndexed: 0,

        totalTweetsToArchive: 0,
        tweetsArchived: 0,
        newTweetsArchived: 0,

        totalLikesToArchive: 0,
        likesArchived: 0,

        totalBookmarksToIndex: 0,
        bookmarksIndexed: 0,

        totalConversations: 0,
        conversationMessagesIndexed: 0,

        totalTweetsToDelete: 0,
        tweetsDeleted: 0,

        totalRetweetsToDelete: 0,
        retweetsDeleted: 0,

        totalLikesToDelete: 0,
        likesDeleted: 0,

        totalBookmarksToDelete: 0,
        bookmarksDeleted: 0,

        conversationsDeleted: 0,
        accountsUnfollowed: 0,

        totalTweetsToMigrate: 0,
        migrateTweetsCount: 0,
        migrateSkippedTweetsCount: 0,
        migrateSkippedTweetsErrors: {},

        totalMigratedPostsToDelete: 0,
        migrateDeletePostsCount: 0,
        migrateDeleteSkippedPostsCount: 0,

        errorsOccured: 0,
    };
}

export type XTweetItem = {
    id: string; // tweetID
    t: string; // text
    l: number; // likeCount
    r: number; // retweetCount
    d: string; // createdAt
    i: string[]; // image filenames
    v: string[]; // video filenames
}

export type XTweetItemArchive = {
    url: string,
    username: string,
    tweetID: string,
    basename: string,
}

export type XArchiveStartResponse = {
    outputPath: string;
    items: XTweetItemArchive[]
}

export function emptyXArchiveStartResponse(): XArchiveStartResponse {
    return {
        outputPath: "",
        items: []
    }
}

export type XIndexMessagesStartResponse = {
    conversationIDs: string[];
    totalConversations: number;
}

export type XRateLimitInfo = {
    isRateLimited: boolean;
    rateLimitReset: number;
}

export function emptyXRateLimitInfo(): XRateLimitInfo {
    return {
        isRateLimited: false,
        rateLimitReset: 0,
    }
}

export type XProgressInfo = {
    accountUUID: string;
    totalTweetsIndexed: number;
    totalTweetsArchived: number;
    totalRetweetsIndexed: number;
    totalLikesIndexed: number;
    totalBookmarksIndexed: number;
    totalUnknownIndexed: number;
    totalTweetsDeleted: number;
    totalRetweetsDeleted: number;
    totalLikesDeleted: number;
    totalBookmarksDeleted: number;
    totalConversationsDeleted: number;
    totalAccountsUnfollowed: number;
    totalTweetsMigratedToBluesky: number;
}

export function emptyXProgressInfo(): XProgressInfo {
    return {
        accountUUID: "",
        totalTweetsIndexed: 0,
        totalTweetsArchived: 0,
        totalRetweetsIndexed: 0,
        totalLikesIndexed: 0,
        totalBookmarksIndexed: 0,
        totalUnknownIndexed: 0,
        totalTweetsDeleted: 0,
        totalRetweetsDeleted: 0,
        totalLikesDeleted: 0,
        totalBookmarksDeleted: 0,
        totalConversationsDeleted: 0,
        totalAccountsUnfollowed: 0,
        totalTweetsMigratedToBluesky: 0,
    }
}

export type XDeleteTweetsStartResponse = {
    tweets: XTweetItem[];
}

export type XDatabaseStats = {
    tweetsSaved: number;
    tweetsDeleted: number;
    retweetsSaved: number;
    retweetsDeleted: number;
    likesSaved: number;
    likesDeleted: number;
    bookmarksSaved: number;
    bookmarksDeleted: number;
    conversationsDeleted: number;
    accountsUnfollowed: number;
    tweetsMigratedToBluesky: number;
}

export function emptyXDatabaseStats(): XDatabaseStats {
    return {
        tweetsSaved: 0,
        tweetsDeleted: 0,
        retweetsSaved: 0,
        retweetsDeleted: 0,
        likesSaved: 0,
        likesDeleted: 0,
        bookmarksSaved: 0,
        bookmarksDeleted: 0,
        conversationsDeleted: 0,
        accountsUnfollowed: 0,
        tweetsMigratedToBluesky: 0,
    }
}

export type XDeleteReviewStats = {
    tweetsToDelete: number;
    retweetsToDelete: number;
    likesToDelete: number;
    bookmarksToDelete: number;
}

export function emptyXDeleteReviewStats(): XDeleteReviewStats {
    return {
        tweetsToDelete: 0,
        retweetsToDelete: 0,
        likesToDelete: 0,
        bookmarksToDelete: 0
    }
}

export interface XImportArchiveResponse {
    status: string; // "success", "error"
    errorMessage: string;
    importCount: number;
    skipCount: number;
}

// Migration types

export type XMigrateTweetCounts = {
    totalTweetsCount: number;
    totalRetweetsCount: number;
    toMigrateTweets: XTweetItem[];
    cannotMigrateCount: number;
    alreadyMigratedTweets: XTweetItem[];
}

export function emptyXMigrateTweetCounts(): XMigrateTweetCounts {
    return {
        totalTweetsCount: 0,
        totalRetweetsCount: 0,
        toMigrateTweets: [],
        cannotMigrateCount: 0,
        alreadyMigratedTweets: []
    }
}