export enum AutomationErrorType {
  // X
  X_manualBugReport = "X_manualBugReport",
  X_login_FailedToGetUsername = "X_login_FailedToGetUsername",
  X_login_URLChanged = "X_login_URLChanged",
  X_login_WaitingForURLFailed = "X_login_WaitingForURLFailed",
  X_login_GetViewerUserFailed = "X_login_GetViewerUserFailed",
  x_runJob_indexTweets_Timeout = "x_runJob_indexTweets_Timeout",
  x_runJob_indexTweets_URLChanged = "x_runJob_indexTweets_URLChanged",
  x_runJob_indexTweets_OtherError = "x_runJob_indexTweets_OtherError",
  x_runJob_indexTweets_ParseTweetsError = "x_runJob_indexTweets_ParseTweetsError",
  x_runJob_indexTweets_VerifyThereIsNoMoreError = "x_runJob_indexTweets_VerifyThereIsNoMoreError",
  x_runJob_indexTweets_TimelineUnreadable = "x_runJob_indexTweets_TimelineUnreadable",
  x_runJob_indexLikes_Timeout = "x_runJob_indexLikes_Timeout",
  x_runJob_indexLikes_URLChanged = "x_runJob_indexLikes_URLChanged",
  x_runJob_indexLikes_OtherError = "x_runJob_indexLikes_OtherError",
  x_runJob_indexLikes_ParseTweetsError = "x_runJob_indexLikes_ParseTweetsError",
  x_runJob_indexLikes_VerifyThereIsNoMoreError = "x_runJob_indexLikes_VerifyThereIsNoMoreError",
  x_runJob_indexLikes_TimelineUnreadable = "x_runJob_indexLikes_TimelineUnreadable",
  x_runJob_archiveTweets_FailedToStart = "x_runJob_archiveTweets_FailedToStart",
  x_runJob_archiveTweets_FailedToCheckDate = "x_runJob_archiveTweets_FailedToCheckDate",
  x_runJob_archiveTweets_FailedToArchive = "x_runJob_archiveTweets_FailedToArchive",
  x_runJob_archiveTweets_WaitForSelectorError = "x_runJob_archiveTweets_WaitForSelectorError",
  x_runJob_indexBookmarks_Timeout = "x_runJob_indexBookmarks_Timeout",
  x_runJob_indexBookmarks_URLChanged = "x_runJob_indexBookmarks_URLChanged",
  x_runJob_indexBookmarks_OtherError = "x_runJob_indexBookmarks_OtherError",
  x_runJob_indexBookmarks_ParseTweetsError = "x_runJob_indexBookmarks_ParseTweetsError",
  x_runJob_indexBookmarks_VerifyThereIsNoMoreError = "x_runJob_indexBookmarks_VerifyThereIsNoMoreError",
  x_runJob_indexBookmarks_TimelineUnreadable = "x_runJob_indexBookmarks_TimelineUnreadable",
  x_runJob_archiveBuild_ArchiveBuildError = "x_runJob_archiveBuild_ArchiveBuildError",
  x_runJob_deleteTweets_FailedToStart = "x_runJob_deleteTweets_FailedToStart",
  x_runJob_deleteTweets_Ct0CookieNotFound = "x_runJob_deleteTweets_Ct0CookieNotFound",
  x_runJob_deleteTweets_FailedToDelete = "x_runJob_deleteTweets_FailedToDelete",
  x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp = "x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp",
  x_runJob_deleteTweets_UnknownError = "x_runJob_deleteTweets_UnknownError",
  x_runJob_deleteRetweets_FailedToStart = "x_runJob_deleteRetweets_FailedToStart",
  x_runJob_deleteRetweets_Ct0CookieNotFound = "x_runJob_deleteRetweets_Ct0CookieNotFound",
  x_runJob_deleteRetweets_FailedToDelete = "x_runJob_deleteRetweets_FailedToDelete",
  x_runJob_deleteRetweets_FailedToUpdateDeleteTimestamp = "x_runJob_deleteRetweets_FailedToUpdateDeleteTimestamp",
  x_runJob_deleteRetweets_UnknownError = "x_runJob_deleteRetweets_UnknownError",
  x_runJob_deleteLikes_FailedToStart = "x_runJob_deleteLikes_FailedToStart",
  x_runJob_deleteLikes_Ct0CookieNotFound = "x_runJob_deleteLikes_Ct0CookieNotFound",
  x_runJob_deleteLikes_FailedToDelete = "x_runJob_deleteLikes_FailedToDelete",
  x_runJob_deleteLikes_FailedToUpdateDeleteTimestamp = "x_runJob_deleteLikes_FailedToUpdateDeleteTimestamp",
  x_runJob_deleteBookmarks_FailedToStart = "x_runJob_deleteBookmarks_FailedToStart",
  x_runJob_deleteBookmarks_Ct0CookieNotFound = "x_runJob_deleteBookmarks_Ct0CookieNotFound",
  x_runJob_deleteBookmarks_FailedToUpdateDeleteTimestamp = "x_runJob_deleteBookmarks_FailedToUpdateDeleteTimestamp",
  x_runJob_deleteBookmarks_FailedToDelete = "x_runJob_deleteBookmarks_FailedToDelete",
  x_runJob_unfollowEveryone_URLChanged = "x_runJob_unfollowEveryone_URLChanged",
  x_runJob_unfollowEveryone_OtherError = "x_runJob_unfollowEveryone_OtherError",
  x_runJob_unfollowEveryone_MouseoverFailed = "x_runJob_unfollowEveryone_MouseoverFailed",
  x_runJob_unfollowEveryone_UnknownError = "x_runJob_unfollowEveryone_UnknownError",
  x_runJob_unfollowEveryone_ClickUnfollowFailed = "x_runJob_unfollowEveryone_ClickUnfollowFailed",
  x_runJob_unfollowEveryone_WaitForConfirmButtonFailed = "x_runJob_unfollowEveryone_WaitForConfirmButtonFailed",
  x_runJob_unfollowEveryone_ClickConfirmFailed = "x_runJob_unfollowEveryone_ClickConfirmFailed",
  x_runJob_tombstoneUpdateBanner_FailedToSetBanner = "x_runJob_tombstoneUpdateBanner_FailedToSetBanner",
  x_runJob_tombstoneUpdateBanner_FailedToSave = "x_runJob_tombstoneUpdateBanner_FailedToSave",
  x_runJob_tombstoneUpdateBio_FailedToSave = "x_runJob_tombstoneUpdateBio_FailedToSave",
  x_runJob_tombstoneLockAccount_FailedToLock = "x_runJob_tombstoneLockAccount_FailedToLock",
  x_runJob_UnknownError = "x_runJob_UnknownError",
  x_runError = "x_runError",
  x_unknownError = "x_unknown",
  x_loadURLError = "x_loadURLError",
  x_loadURLURLChanged = "x_loadURLURLChanged",

  // Facebook
  facebook_manualBugReport = "facebook_manualBugReport",
  facebook_runJob_UnknownError = "facebook_runJob_UnknownError",
  facebook_runError = "facebook_runError",
  facebook_unknownError = "facebook_unknown",
  facebook_login_LoadFailed = "facebook_login_LoadFailed",
  facebook_login_WaitForLoginTimeout = "facebook_login_WaitForLoginTimeout",
  facebook_login_CaptureIdentityFailed = "facebook_login_CaptureIdentityFailed",
  facebook_runJob_language_OpenDialogFailed = "facebook_runJob_language_OpenDialogFailed",
  facebook_runJob_language_SelectLanguageFailed = "facebook_runJob_language_SelectLanguageFailed",
  facebook_runJob_deleteWallPosts_ClickManagePostsFailed = "facebook_runJob_deleteWallPosts_ClickManagePostsFailed",
  facebook_runJob_deleteWallPosts_ClickNextFailed = "facebook_runJob_deleteWallPosts_ClickNextFailed",
  facebook_runJob_deleteWallPosts_DialogNotFound = "facebook_runJob_deleteWallPosts_DialogNotFound",
  facebook_runJob_deleteWallPosts_SelectDeleteOptionFailed = "facebook_runJob_deleteWallPosts_SelectDeleteOptionFailed",
  facebook_runJob_deleteWallPosts_SelectUntagOptionFailed = "facebook_runJob_deleteWallPosts_SelectUntagOptionFailed",
  facebook_runJob_deleteWallPosts_SelectHideOptionFailed = "facebook_runJob_deleteWallPosts_SelectHideOptionFailed",
  facebook_runJob_deleteWallPosts_ClickDoneFailed = "facebook_runJob_deleteWallPosts_ClickDoneFailed",
  facebook_runJob_deleteWallPosts_CompletionTimeout = "facebook_runJob_deleteWallPosts_CompletionTimeout",

  // Bluesky
  bluesky_runError = "bluesky_runError",
  bluesky_openLocalAccountError = "bluesky_openLocalAccountError",
  bluesky_connectError = "bluesky_connectError",
  bluesky_disconnectError = "bluesky_disconnectError",
  bluesky_saveError = "bluesky_saveError",
  bluesky_browseError = "bluesky_browseError",
}

export const AutomationErrorTypeToMessage = {
  // X
  [AutomationErrorType.X_manualBugReport]: "You're manually reporting a bug",
  [AutomationErrorType.X_login_FailedToGetUsername]:
    "Failed to get username on login",
  [AutomationErrorType.X_login_URLChanged]: "URL changed on login",
  [AutomationErrorType.X_login_WaitingForURLFailed]:
    "Waiting for URL failed on login",
  [AutomationErrorType.X_login_GetViewerUserFailed]:
    "Failed to get user information on login",
  [AutomationErrorType.x_runJob_indexTweets_Timeout]:
    "Timeout while indexing tweets",
  [AutomationErrorType.x_runJob_indexTweets_URLChanged]:
    "URL changed while indexing tweets",
  [AutomationErrorType.x_runJob_indexTweets_OtherError]:
    "Error while indexing tweets",
  [AutomationErrorType.x_runJob_indexTweets_ParseTweetsError]:
    "Failed to parse tweets while indexing tweets",
  [AutomationErrorType.x_runJob_indexTweets_VerifyThereIsNoMoreError]:
    "Failed to verify you finished saving tweets while indexing tweets",
  [AutomationErrorType.x_runJob_indexTweets_TimelineUnreadable]:
    "X did not return a timeline Cyd could read while indexing tweets",
  [AutomationErrorType.x_runJob_indexLikes_Timeout]:
    "Timeout while indexing likes",
  [AutomationErrorType.x_runJob_indexLikes_URLChanged]:
    "URL changed while indexing likes",
  [AutomationErrorType.x_runJob_indexLikes_OtherError]:
    "Error while indexing likes",
  [AutomationErrorType.x_runJob_indexLikes_ParseTweetsError]:
    "Failed to parse tweets while indexing likes",
  [AutomationErrorType.x_runJob_indexLikes_VerifyThereIsNoMoreError]:
    "Failed to verify you finished saving likes while indexing likes",
  [AutomationErrorType.x_runJob_indexLikes_TimelineUnreadable]:
    "X did not return a timeline Cyd could read while indexing likes",
  [AutomationErrorType.x_runJob_archiveTweets_FailedToStart]:
    "Failed to start archiving tweets",
  [AutomationErrorType.x_runJob_archiveTweets_FailedToCheckDate]:
    "Failed to check date while archiving tweets",
  [AutomationErrorType.x_runJob_archiveTweets_FailedToArchive]:
    "Failed to create an archive of a tweet",
  [AutomationErrorType.x_runJob_archiveTweets_WaitForSelectorError]:
    "Failed to wait for tweet to load while archiving as HTML",
  [AutomationErrorType.x_runJob_indexBookmarks_Timeout]:
    "Timeout while indexing bookmarks",
  [AutomationErrorType.x_runJob_indexBookmarks_URLChanged]:
    "URL changed while indexing bookmarks",
  [AutomationErrorType.x_runJob_indexBookmarks_OtherError]:
    "Error while indexing bookmarks",
  [AutomationErrorType.x_runJob_indexBookmarks_ParseTweetsError]:
    "Failed to parse tweets while indexing bookmarks",
  [AutomationErrorType.x_runJob_indexBookmarks_VerifyThereIsNoMoreError]:
    "Failed to verify you finished saving bookmarks while indexing bookmarks",
  [AutomationErrorType.x_runJob_indexBookmarks_TimelineUnreadable]:
    "X did not return a timeline Cyd could read while indexing bookmarks",
  [AutomationErrorType.x_runJob_archiveBuild_ArchiveBuildError]:
    "Failed to archive build",
  [AutomationErrorType.x_runJob_deleteTweets_FailedToStart]:
    "Failed to start deleting tweets",
  [AutomationErrorType.x_runJob_deleteTweets_Ct0CookieNotFound]:
    "ct0 cookie not found while deleting tweets",
  [AutomationErrorType.x_runJob_deleteTweets_FailedToDelete]:
    "Failed to delete tweet",
  [AutomationErrorType.x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp]:
    "Failed to update delete timestamp while deleting tweets",
  [AutomationErrorType.x_runJob_deleteTweets_UnknownError]:
    "An unknown error occurred while deleting tweets",
  [AutomationErrorType.x_runJob_deleteRetweets_FailedToStart]:
    "Failed to start deleting retweets",
  [AutomationErrorType.x_runJob_deleteRetweets_Ct0CookieNotFound]:
    "ct0 cookie not found while deleting retweets",
  [AutomationErrorType.x_runJob_deleteRetweets_FailedToDelete]:
    "Failed to delete retweet",
  [AutomationErrorType.x_runJob_deleteRetweets_FailedToUpdateDeleteTimestamp]:
    "Failed to update delete timestamp while deleting retweets",
  [AutomationErrorType.x_runJob_deleteRetweets_UnknownError]:
    "An unknown error occurred while deleting retweets",
  [AutomationErrorType.x_runJob_deleteLikes_FailedToStart]:
    "Failed to start deleting likes",
  [AutomationErrorType.x_runJob_deleteLikes_Ct0CookieNotFound]:
    "ct0 cookie not found while deleting likes",
  [AutomationErrorType.x_runJob_deleteLikes_FailedToDelete]:
    "Failed to delete like",
  [AutomationErrorType.x_runJob_deleteLikes_FailedToUpdateDeleteTimestamp]:
    "Failed to update delete timestamp while deleting likes",
  [AutomationErrorType.x_runJob_deleteBookmarks_FailedToStart]:
    "Failed to start deleting bookmarks",
  [AutomationErrorType.x_runJob_deleteBookmarks_Ct0CookieNotFound]:
    "ct0 cookie not found while deleting bookmarks",
  [AutomationErrorType.x_runJob_deleteBookmarks_FailedToUpdateDeleteTimestamp]:
    "Failed to update delete timestamp while deleting bookmarks",
  [AutomationErrorType.x_runJob_deleteBookmarks_FailedToDelete]:
    "Failed to delete bookmark",
  [AutomationErrorType.x_runJob_unfollowEveryone_URLChanged]:
    "URL changed while unfollowing everyone",
  [AutomationErrorType.x_runJob_unfollowEveryone_OtherError]:
    "Error while unfollowing everyone",
  [AutomationErrorType.x_runJob_unfollowEveryone_MouseoverFailed]:
    "Failed to mouseover while unfollowing everyone",
  [AutomationErrorType.x_runJob_unfollowEveryone_ClickUnfollowFailed]:
    "Failed to click unfollow while unfollowing everyone",
  [AutomationErrorType.x_runJob_unfollowEveryone_WaitForConfirmButtonFailed]:
    "Failed to wait for confirm button while unfollowing everyone",
  [AutomationErrorType.x_runJob_unfollowEveryone_UnknownError]:
    "An unknown error occurred while unfollowing everyone",
  [AutomationErrorType.x_runJob_unfollowEveryone_ClickConfirmFailed]:
    "Failed to click confirm while unfollowing everyone",
  [AutomationErrorType.x_runJob_tombstoneUpdateBanner_FailedToSetBanner]:
    "Failed to set the tombstone banner image",
  [AutomationErrorType.x_runJob_tombstoneUpdateBanner_FailedToSave]:
    "Failed to save the tombstone banner image",
  [AutomationErrorType.x_runJob_tombstoneUpdateBio_FailedToSave]:
    "Failed to save the tombstone bio text",
  [AutomationErrorType.x_runJob_tombstoneLockAccount_FailedToLock]:
    "Failed to lock the account",
  [AutomationErrorType.x_runJob_UnknownError]: "An unknown error occurred",
  [AutomationErrorType.x_runError]: "Error while in X run function",
  [AutomationErrorType.x_unknownError]: "An unknown error occurred",
  [AutomationErrorType.x_loadURLError]: "Error while loading URL",
  [AutomationErrorType.x_loadURLURLChanged]: "URL changed after loading",

  // Facebook
  [AutomationErrorType.facebook_manualBugReport]:
    "You're manually reporting a bug",
  [AutomationErrorType.facebook_runJob_UnknownError]:
    "An unknown error occurred",
  [AutomationErrorType.facebook_runError]:
    "Error while in Facebook run function",
  [AutomationErrorType.facebook_unknownError]: "An unknown error occurred",
  [AutomationErrorType.facebook_login_LoadFailed]:
    "Failed to load Facebook during login",
  [AutomationErrorType.facebook_login_WaitForLoginTimeout]:
    "Timed out waiting for Facebook login to complete",
  [AutomationErrorType.facebook_login_CaptureIdentityFailed]:
    "Failed to capture Facebook identity information",
  [AutomationErrorType.facebook_runJob_language_OpenDialogFailed]:
    "Failed to open Facebook language settings",
  [AutomationErrorType.facebook_runJob_language_SelectLanguageFailed]:
    "Failed to select the desired Facebook language",
  [AutomationErrorType.facebook_runJob_deleteWallPosts_ClickManagePostsFailed]:
    "Failed to click the Manage posts button on Facebook",
  [AutomationErrorType.facebook_runJob_deleteWallPosts_ClickNextFailed]:
    "Failed to click Next in the Facebook Manage posts dialog",
  [AutomationErrorType.facebook_runJob_deleteWallPosts_DialogNotFound]:
    "Failed to open the Manage posts dialog on Facebook",
  [AutomationErrorType.facebook_runJob_deleteWallPosts_SelectDeleteOptionFailed]:
    "Failed to select the delete posts option on Facebook",
  [AutomationErrorType.facebook_runJob_deleteWallPosts_SelectUntagOptionFailed]:
    "Failed to select the untag posts option on Facebook",
  [AutomationErrorType.facebook_runJob_deleteWallPosts_SelectHideOptionFailed]:
    "Failed to select the hide posts option on Facebook",
  [AutomationErrorType.facebook_runJob_deleteWallPosts_ClickDoneFailed]:
    "Failed to click Done while deleting Facebook posts",
  [AutomationErrorType.facebook_runJob_deleteWallPosts_CompletionTimeout]:
    "Timed out waiting for Facebook to finish deleting posts",

  // Bluesky
  [AutomationErrorType.bluesky_runError]:
    "An error occurred in your Bluesky account",
  [AutomationErrorType.bluesky_openLocalAccountError]:
    "Failed to open this Bluesky account's local storage",
  [AutomationErrorType.bluesky_connectError]:
    "Failed to connect this Bluesky account",
  [AutomationErrorType.bluesky_disconnectError]:
    "Failed to disconnect this Bluesky account",
  [AutomationErrorType.bluesky_saveError]:
    "Failed to save this Bluesky account's data",
  [AutomationErrorType.bluesky_browseError]:
    "Failed to read this Bluesky account's saved data",
};
