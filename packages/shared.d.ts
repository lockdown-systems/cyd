type XAccount = {
    id: number;
    createdAt: Date;
    updatedAt: Date;
    accessedAt: Date;
    username: string;
    cookies: string;
    deleteTweets: boolean;
    tweetsDaysThreshold: number;
    tweetsEnableRetweetThreshold: boolean;
    tweetsLikeThreshold: number;
    deleteLikes: boolean;
    likesDaysThreshold: number;
    deleteDirectMessages: boolean;
    directMessageDaysThreshold: number;
};