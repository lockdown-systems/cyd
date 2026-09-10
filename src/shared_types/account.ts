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

/**
 * This installation's local representation of a Bluesky identity. It is
 * identified by its Cyd UUID, which is also the account's UUID, so a handle
 * change never moves its storage.
 */
export type BlueskyLocalAccount = {
  uuid: string;
  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date;
  /** The durable Bluesky identity, once it is known. */
  did: string | null;
  /** Mutable profile data; never used to locate storage. */
  handle: string | null;
  displayName: string | null;
  profileImageDataURI: string | null;
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
