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
}

export type XAccount = {
    id: number;
    createdAt: Date;
    updatedAt: Date;
    accessedAt: Date;
    username: string;
    archiveTweets: boolean;
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
    tweetId: string; // id_str
    conversationId: string; // conversation_id_str
    createdAt: Date; // created_at
    likeCount: number; // favorite_count
    quoteCount: number; // quote_count
    replyCount: number; // reply_count
    retweetCount: number; // retweet_count
    isLiked: boolean; // favorited
    isRetweeted: boolean; // retweeted
    text: string; // full_text
    path: string; // "{username}/status/{tweetId}"
    addedToDatabaseAt: Date;
    archivedAt: Date | null;
};

// Other X types

export type XProgress = {
    // "indexTweets", "indexLikes", "indexDMs", "archiveTweets", "archiveDMs", "deleteTweets", "deleteLikes", "deleteDMs"
    currentJob: string;

    isIndexTweetsFinished: boolean;
    isIndexDMConversationsFinished: boolean;
    isIndexDMsFinished: boolean;
    isIndexLikesFinished: boolean;
    isArchiveTweetsFinished: boolean;
    isDeleteFinished: boolean;

    tweetsIndexed: number;
    retweetsIndexed: number;
    dmUsersIndexed: number;
    dmConversationsIndexed: number;
    dmMessagesIndexed: number;
    likesIndexed: number;

    totalTweetsToArchive: number;
    tweetsArchived: number;

    tweetsDeleted: number;
    retweetsDeleted: number;
    likesDeleted: number;
    dmConversationsDeleted: number;

    isRateLimited: boolean;
    rateLimitReset: null | number;
}

export type XArchiveItem = {
    url: string,
    basename: string
}

export type XArchiveStartResponse = {
    outputPath: string;
    items: XArchiveItem[]
}

export type XIndexDMsStartResponse = {
    conversationIDs: string[]
}

export type XRateLimitInfo = {
    isRateLimited: boolean;
    rateLimitReset: number;
}