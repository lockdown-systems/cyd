export type ResponseData = {
    host: string;
    url: string;
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
    processed: boolean;
}

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
    archivedAt: Date;
};

export type XProgress = {
    currentJob: string; // "index", "archive", or "delete"

    isIndexFinished: boolean;
    isArchiveFinished: boolean;
    isDeleteFinished: boolean;

    tweetsIndexed: number;
    retweetsIndexed: number;

    tweetsArchived: number;
    directMessageConversationsArchived: number;

    tweetsDeleted: number;
    retweetsDeleted: number;
    likesDeleted: number;
    directMessagesDeleted: number;

    isRateLimited: boolean;
    rateLimitReset: null | number;
}