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
    archiveDirectMessages: boolean;
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
    deleteDirectMessages: boolean;
    deleteDirectMessagesDaysOld: number;
};

// X models

export type XJob = {
    id: number | null;
    jobType: string; // "login", "index", "archiveTweets", "archiveDirectMessages", "deleteTweets", "deleteLikes", "deleteDirectMessages"
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
    currentJob: string; // "index", "archiveTweets", "archiveDirectMessages", or "delete"

    isIndexFinished: boolean;
    isArchiveTweetsFinished: boolean;
    isArchiveDirectMessagesFinished: boolean;
    isDeleteFinished: boolean;

    tweetsIndexed: number;
    retweetsIndexed: number;

    totalTweetsToArchive: number;
    tweetsArchived: number;
    totalDirectMessageConversationsToArchive: number;
    directMessageConversationsArchived: number;

    tweetsDeleted: number;
    retweetsDeleted: number;
    likesDeleted: number;
    directMessagesDeleted: number;

    isRateLimited: boolean;
    rateLimitReset: null | number;
}

export type XArchiveTweetsTweet = {
    url: string,
    filename: string
}

export type XArchiveTweetsStartResponse = {
    outputPath: string;
    tweets: XArchiveTweetsTweet[]
}

export type XIsRateLimitedResponse = {
    isRateLimited: boolean;
    rateLimitReset: number;
}