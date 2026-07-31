export type Account = {
  id: number;
  type: string; // "X"
  sortOrder: number;
  xAccount: XAccount | null;
  blueskyLocalAccount: BlueskyLocalAccount | null;
  facebookAccount: FacebookAccount | null;
  uuid: string;
};

export type XAccount = {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date;
  username: string;
  userID: string;
  bio: string;
  profileImageDataURI: string;
  importFromArchive: boolean;
  saveMyData: boolean;
  deleteMyData: boolean;
  archiveOnly?: boolean;
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
  tombstoneUpdateBanner: boolean;
  tombstoneUpdateBannerBackground: string;
  tombstoneUpdateBannerSocialIcons: string;
  tombstoneUpdateBannerShowText: boolean;
  tombstoneBannerDataURL: string;
  tombstoneUpdateBio: boolean;
  tombstoneUpdateBioText: string;
  tombstoneUpdateBioCreditCyd: boolean;
  tombstoneLockAccount: boolean;
};

export type BlueskyLocalAccount = {
  uuid: string;
  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date;
  did: string | null;
  handle: string;
  displayName: string;
  avatarUrl: string;
};

export type FacebookAccount = {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date;
  username: string;
  profileImageDataURI: string;
  accountID: string | null;
  deleteWallPosts: boolean;
  deleteComments: boolean;
  deleteReactions: boolean;
  deletePostsOnOthers: boolean;
  deleteOthersPosts: boolean;
  deleteCheckins: boolean;
  deleteTaggedPosts: boolean;
  deleteTaggedMedia: boolean;
  userLang: string;
};

export type FacebookProgressInfo = {
  accountUUID: string;
  totalWallPostsDeleted: number;
  totalWallPostsUntagged: number;
  totalWallPostsHidden: number;
};

export function emptyFacebookProgressInfo(): FacebookProgressInfo {
  return {
    accountUUID: "",
    totalWallPostsDeleted: 0,
    totalWallPostsUntagged: 0,
    totalWallPostsHidden: 0,
  };
}
