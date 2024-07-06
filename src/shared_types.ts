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
    xAccountId: number;
    tweetId: string;
    username: string;
    timestamp: Date;
    text: string;
    retweets: number;
    likes: number;
    isRetweet: boolean;
    path: string; // "{username}/status/{tweetId}"
};