export type DeviceInfo = {
  userEmail: string;
  deviceDescription: string;
  deviceToken: string;
  deviceUUID: string;
  apiToken: string;
  valid: boolean;
};

export const PlausibleEvents = Object.freeze({
  APP_OPENED: "App Opened",
  AUTOMATION_ERROR_OCCURED: "Automation Error Occurred",
  AUTOMATION_ERROR_REPORT_SUBMITTED: "Automation Error Report Submitted",
  AUTOMATION_ERROR_REPORT_NOT_SUBMITTED:
    "Automation Error Report Not Submitted",
  AUTOMATION_ERROR_REPORT_ERROR: "Automation Error Report Error",

  X_USER_SIGNED_IN: "X User Signed In",
  X_JOB_STARTED_LOGIN: "X Job Started: login",
  X_JOB_STARTED_INDEX_TWEETS: "X Job Started: indexTweets",
  X_JOB_STARTED_ARCHIVE_TWEETS: "X Job Started: archiveTweets",
  X_JOB_STARTED_INDEX_LIKES: "X Job Started: indexLikes",
  X_JOB_STARTED_INDEX_BOOKMARKS: "X Job Started: indexBookmarks",
  X_JOB_STARTED_INDEX_CONVERSATIONS: "X Job Started: indexConversations",
  X_JOB_STARTED_INDEX_MESSAGES: "X Job Started: indexMessages",
  X_JOB_STARTED_DELETE_TWEETS: "X Job Started: deleteTweets",
  X_JOB_STARTED_DELETE_RETWEETS: "X Job Started: deleteRetweets",
  X_JOB_STARTED_DELETE_LIKES: "X Job Started: deleteLikes",
  X_JOB_STARTED_DELETE_BOOKMARKS: "X Job Started: deleteBookmarks",
  X_JOB_STARTED_DELETE_DMS: "X Job Started: deleteDMs",
  X_JOB_STARTED_ARCHIVE_BUILD: "X Job Started: archiveBuild",
  X_JOB_STARTED_UNFOLLOW_EVERYONE: "X Job Started: unfollowEveryone",
  X_JOB_STARTED_MIGRATE_BLUESKY: "X Job Started: migrateBluesky",
  X_JOB_STARTED_MIGRATE_BLUESKY_DELETE: "X Job Started: migrateBlueskyDelete",

  FACEBOOK_USER_SIGNED_IN: "Facebook User Signed In",
  FACEBOOK_JOB_STARTED_LOGIN: "Facebook Job Started: login",
  FACEBOOK_JOB_STARTED_SAVE_POSTS: "Facebook Job Started: savePosts",
  FACEBOOK_JOB_STARTED_SAVE_POSTS_HTML: "Facebook Job Started: savePostsHTML",
  FACEBOOK_JOB_STARTED_DELETE_POSTS: "Facebook Job Started: deletePosts",
  FACEBOOK_JOB_STARTED_ARCHIVE_BUILD: "Facebook Job Started: archiveBuild",
});

export type ButtonInfo = {
  label: string;
  icon?: string;
  action: () => void;
  disabled?: boolean;
};
