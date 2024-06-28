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
    deleteTweets: boolean;
    tweetsDaysThreshold: number;
    tweetsEnableRetweetThreshold: boolean;
    tweetsLikeThreshold: number;
    deleteLikes: boolean;
    likesDaysThreshold: number;
    deleteDirectMessages: boolean;
    directMessageDaysThreshold: number;
};