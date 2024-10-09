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
    archiveTweets: boolean;
    archiveLikes: boolean;
    archiveDMs: boolean;
    deleteTweets: boolean;
    deleteTweetsDaysOld: number;
    deleteTweetsLikesThresholdEnabled: boolean;
    deleteTweetsLikesThreshold: number;
    deleteTweetsRetweetsThresholdEnabled: boolean;
    deleteTweetsRetweetsThreshold: number;
    deleteRetweets: boolean;
    deleteRetweetsDaysOld: number;
    deleteLikes: boolean;
    deleteLikesDaysOld: number;
    deleteDMs: boolean;
    deleteDMsDaysOld: number;
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

    messagesDeleted: number;
    totalMessagesToDelete: number;
    dmConversationsDeleted: number;
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

        messagesDeleted: 0,
        totalMessagesToDelete: 0,
        dmConversationsDeleted: 0
    };
}

export type XArchiveItem = {
    url: string,
    id: string,
    basename: string
}

export type XArchiveStartResponse = {
    outputPath: string;
    items: XArchiveItem[]
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

export function emptyXIndexMessagesStartResponse(): XIndexMessagesStartResponse {
    return {
        conversationIDs: [],
        totalConversations: 0
    }
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
        totalMessagesDeleted: 0
    }
}

export type XDeleteTweetsStartResponse = {
    tweets: {
        username: string;
        tweetID: string;
    }[];
}