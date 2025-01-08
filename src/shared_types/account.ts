export type Account = {
    id: number;
    type: string; // "X"
    sortOrder: number;
    xAccount: XAccount | null;
    blueskyAccount: BlueskyAccount | null;
    uuid: string;
}

export type XAccount = {
    id: number;
    createdAt: Date;
    updatedAt: Date;
    accessedAt: Date;
    username: string;
    profileImageDataURI: string;
    importFromArchive: boolean;
    saveMyData: boolean;
    deleteMyData: boolean;
    archiveMyData: boolean;
    archiveTweets: boolean;
    archiveTweetsHTML: boolean;
    archiveLikes: boolean;
    archiveBookmarks: boolean;
    archiveDMs: boolean;
    deleteTweets: boolean;
    deleteTweetsDaysOldEnabled: boolean;
    deleteTweetsDaysOld: number;
    deleteTweetsLikesThresholdEnabled: boolean;
    deleteTweetsLikesThreshold: number;
    deleteTweetsRetweetsThresholdEnabled: boolean;
    deleteTweetsRetweetsThreshold: number;
    deleteRetweets: boolean;
    deleteRetweetsDaysOldEnabled: boolean;
    deleteRetweetsDaysOld: number;
    deleteLikes: boolean;
    deleteBookmarks: boolean;
    deleteDMs: boolean;
    unfollowEveryone: boolean;
    followingCount: number;
    followersCount: number;
    tweetsCount: number;
    likesCount: number;
};

export type BlueskyAccount = {
    id: number;
    createdAt: Date;
    updatedAt: Date;
    accessedAt: Date;
    username: string;
    profileImageDataURI: string;
    saveMyData: boolean;
    deleteMyData: boolean;
    archivePosts: boolean;
    archivePostsHTML: boolean;
    archiveLikes: boolean;
    deletePosts: boolean;
    deletePostsDaysOldEnabled: boolean;
    deletePostsDaysOld: number;
    deletePostsLikesThresholdEnabled: boolean;
    deletePostsLikesThreshold: number;
    deletePostsRepostsThresholdEnabled: boolean;
    deletePostsRepostsThreshold: number;
    deleteReposts: boolean;
    deleteRepostsDaysOldEnabled: boolean;
    deleteRepostsDaysOld: number;
    deleteLikes: boolean;
    deleteLikesDaysOldEnabled: boolean;
    deleteLikesDaysOld: number;
    followingCount: number;
    followersCount: number;
    postsCount: number;
    likesCount: number;
}