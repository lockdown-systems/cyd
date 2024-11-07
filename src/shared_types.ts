export type ResponseData = {
    host: string;
    url: string;
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
    processed: boolean;
}

// Settings models

export type Account = {
    id: number;
    type: string; // "X"
    sortOrder: number;
    xAccount: XAccount | null;
    uuid: string;
}

export type XAccount = {
    id: number;
    createdAt: Date;
    updatedAt: Date;
    accessedAt: Date;
    username: string;
    profileImageDataURI: string;
    saveMyData: boolean;
    deleteMyData: boolean;
    archiveTweets: boolean;
    archiveTweetsHTML: boolean;
    archiveLikes: boolean;
    archiveDMs: boolean;
    deleteTweets: boolean;
    deleteTweetsDaysOld: number;
    deleteTweetsLikesThresholdEnabled: boolean;
    deleteTweetsLikesThreshold: number;
    deleteTweetsRetweetsThresholdEnabled: boolean;
    deleteTweetsRetweetsThreshold: number;
    deleteTweetsArchiveEnabled: boolean;
    deleteRetweets: boolean;
    deleteRetweetsDaysOld: number;
    deleteLikes: boolean;
    deleteLikesDaysOld: number;
    deleteDMs: boolean;
    chanceToReview: boolean;
};

// X models

export type XJob = {
    id: number | null;
    jobType: string; // "login", "index", "archiveTweets", "archiveDMs", "deleteTweets", "deleteLikes", "deleteDMs"
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

// Other X types

export type XProgress = {
    currentJob: string;

    isIndexTweetsFinished: boolean;
    isIndexConversationsFinished: boolean;
    isIndexMessagesFinished: boolean;
    isIndexLikesFinished: boolean;
    isArchiveTweetsFinished: boolean;
    isArchiveLikesFinished: boolean;
    isDeleteTweetsFinished: boolean;
    isDeleteRetweetsFinished: boolean;
    isDeleteLikesFinished: boolean;
    isDeleteDMsFinished: boolean;

    tweetsIndexed: number;
    retweetsIndexed: number;
    usersIndexed: number;
    conversationsIndexed: number;
    messagesIndexed: number;
    likesIndexed: number;

    totalTweetsToArchive: number;
    tweetsArchived: number;
    newTweetsArchived: number;

    totalLikesToArchive: number;
    likesArchived: number;

    totalConversations: number;
    conversationMessagesIndexed: number;
    shouldStopEarly: boolean;

    totalTweetsToDelete: number;
    tweetsDeleted: number;

    totalRetweetsToDelete: number;
    retweetsDeleted: number;

    totalLikesToDelete: number;
    likesDeleted: number;

    totalConversationsToDelete: number;
    totalMessagesToDelete: number;
    conversationsDeleted: number;
    messagesDeleted: number;
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
        isDeleteTweetsFinished: false,
        isDeleteRetweetsFinished: false,
        isDeleteLikesFinished: false,
        isDeleteDMsFinished: false,

        tweetsIndexed: 0,
        retweetsIndexed: 0,
        usersIndexed: 0,
        conversationsIndexed: 0,
        messagesIndexed: 0,
        likesIndexed: 0,

        totalTweetsToArchive: 0,
        tweetsArchived: 0,
        newTweetsArchived: 0,

        totalLikesToArchive: 0,
        likesArchived: 0,

        totalConversations: 0,
        conversationMessagesIndexed: 0,
        shouldStopEarly: false,

        totalTweetsToDelete: 0,
        tweetsDeleted: 0,

        totalRetweetsToDelete: 0,
        retweetsDeleted: 0,

        totalLikesToDelete: 0,
        likesDeleted: 0,

        totalConversationsToDelete: 0,
        totalMessagesToDelete: 0,
        conversationsDeleted: 0,
        messagesDeleted: 0
    };
}

export type XTweetItem = {
    url: string,
    username: string,
    tweetID: string,
    basename: string,
}

export type XArchiveStartResponse = {
    outputPath: string;
    items: XTweetItem[]
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
    totalTweetsArchived: number;
    totalMessagesIndexed: number;
    totalTweetsDeleted: number;
    totalRetweetsDeleted: number;
    totalLikesDeleted: number;
    totalConversationsDeleted: number;
    totalMessagesDeleted: number;
}

export function emptyXProgressInfo(): XProgressInfo {
    return {
        accountUUID: "",
        totalTweetsArchived: 0,
        totalMessagesIndexed: 0,
        totalTweetsDeleted: 0,
        totalRetweetsDeleted: 0,
        totalLikesDeleted: 0,
        totalConversationsDeleted: 0,
        totalMessagesDeleted: 0
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
    conversationsSaved: number;
    conversationsDeleted: number;
    messagesSaved: number;
    messagesDeleted: number;
}

export function emptyXDatabaseStats(): XDatabaseStats {
    return {
        tweetsSaved: 0,
        tweetsDeleted: 0,
        retweetsSaved: 0,
        retweetsDeleted: 0,
        likesSaved: 0,
        likesDeleted: 0,
        conversationsSaved: 0,
        conversationsDeleted: 0,
        messagesSaved: 0,
        messagesDeleted: 0
    }
}