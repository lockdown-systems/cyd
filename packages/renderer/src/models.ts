interface BaseService {
    id: string;
    serviceType: ServiceType;
    username: string;
}

interface XService extends BaseService {
    serviceType: ServiceType.X;
    deleteTweets: boolean;
    tweetsDaysThreshold: number;
    tweetsEnableRetweetThreshold: boolean;
    tweetsRetweetThreshold: number;
    tweetsEnableLikeThreshold: boolean;
    tweetsLikeThreshold: number;
    deleteLikes: boolean;
    likesDaysThreshold: number;
    deleteDirectMessages: boolean;
    directMessageDaysThreshold: number;
}

interface RedditService extends BaseService {
    serviceType: ServiceType.Reddit;
}

export type Service = XService | RedditService;

export enum ServiceType {
    X = "X",
    Reddit = "Reddit",
}