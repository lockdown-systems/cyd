export enum AutomationErrorType {

    X_login_FailedToGetUsername = "X_login_FailedToGetUsername",
    X_login_URLChanged = "X_login_URLChanged",
    X_login_WaitingForURLFailed = "X_login_WaitingForURLFailed",
    x_runJob_indexTweets_Timeout = "x_runJob_indexTweets_Timeout",
    x_runJob_indexTweets_URLChanged = "x_runJob_indexTweets_URLChanged",
    x_runJob_indexTweets_OtherError = "x_runJob_indexTweets_OtherError",
    x_runJob_indexTweets_ParseTweetsError = "x_runJob_indexTweets_ParseTweetsError",
    x_runJob_indexTweets_FailedToRetryAfterRateLimit = "x_runJob_indexTweets_FailedToRetryAfterRateLimit",
    x_runJob_archiveTweets_FailedToStart = "x_runJob_archiveTweets_FailedToStart",
    x_runJob_archiveTweets_FailedToCheckData = "x_runJob_archiveTweets_FailedToCheckData",
    x_runJob_archiveTweets_FailedToArchive = "x_runJob_archiveTweets_FailedToArchive",
    x_runJob_indexConversations_Timeout = "x_runJob_indexConversations_Timeout",
    x_runJob_indexConversations_URLChanged = "x_runJob_indexConversations_URLChanged",
    x_runJob_indexConversations_OtherError = "x_runJob_indexConversations_OtherError",
    x_runJob_indexConversations_ParseConversationsError = "x_runJob_indexConversations_ParseConversationsError",
    x_runJob_indexMessages_Timeout = "x_runJob_indexMessages_Timeout",
    x_runJob_indexMessages_FailedToStart = "x_runJob_indexMessages_FailedToStart",
    x_runJob_indexMessages_URLChangedButDidnt = "x_runJob_indexMessages_URLChangedButDidnt",
    x_runJob_indexMessages_OtherError = "x_runJob_indexMessages_OtherError",
    x_runJob_indexMessages_ParseMessagesError = "x_runJob_indexMessages_ParseMessagesError",
    x_runJob_archiveBuild_ArchiveBuildError = "x_runJob_archiveBuild_ArchiveBuildError",
    x_runJob_deleteTweets_FailedToStart = "x_runJob_deleteTweets_FailedToStart",
    x_runJob_deleteTweets_WaitForMenuButtonFailed = "x_runJob_deleteTweets_WaitForMenuButtonFailed",
    x_runJob_deleteTweets_WaitForMenuFailed = "x_runJob_deleteTweets_WaitForMenuFailed",
    x_runJob_deleteTweets_WaitForDeleteConfirmationFailed = "x_runJob_deleteTweets_WaitForDeleteConfirmationFailed",
    x_runJob_UnknownError = "x_runJob_UnknownError",
    x_runError = "x_runError",
    x_unknownError = "x_unknown",
    x_loadURLError = "x_loadURLError",
    x_loadURLURLChanged = "x_loadURLURLChanged",
}

export const AutomationErrorTypeToMessage = {
    [AutomationErrorType.X_login_FailedToGetUsername]: "Failed to get username on login",
    [AutomationErrorType.X_login_URLChanged]: "URL changed on login",
    [AutomationErrorType.X_login_WaitingForURLFailed]: "Waiting for URL failed on login",
    [AutomationErrorType.x_runJob_indexTweets_Timeout]: "Timeout while indexing tweets",
    [AutomationErrorType.x_runJob_indexTweets_URLChanged]: "URL changed while indexing tweets",
    [AutomationErrorType.x_runJob_indexTweets_OtherError]: "Error while indexing tweets",
    [AutomationErrorType.x_runJob_indexTweets_ParseTweetsError]: "Failed to parse tweets while indexing tweets",
    [AutomationErrorType.x_runJob_indexTweets_FailedToRetryAfterRateLimit]: "Failed to retry after rate limit while indexing tweets",
    [AutomationErrorType.x_runJob_archiveTweets_FailedToStart]: "Failed to start archiving tweets",
    [AutomationErrorType.x_runJob_archiveTweets_FailedToCheckData]: "Failed to check data while archiving tweets",
    [AutomationErrorType.x_runJob_archiveTweets_FailedToArchive]: "Failed to create an archive of a tweet",
    [AutomationErrorType.x_runJob_indexConversations_Timeout]: "Timeout while indexing conversations",
    [AutomationErrorType.x_runJob_indexConversations_URLChanged]: "URL changed while indexing conversations",
    [AutomationErrorType.x_runJob_indexConversations_OtherError]: "Error while indexing conversations",
    [AutomationErrorType.x_runJob_indexConversations_ParseConversationsError]: "Failed to parse conversations while indexing conversations",
    [AutomationErrorType.x_runJob_indexMessages_Timeout]: "Timeout while indexing messages",
    [AutomationErrorType.x_runJob_indexMessages_FailedToStart]: "Failed to start indexing messages",
    [AutomationErrorType.x_runJob_indexMessages_URLChangedButDidnt]: "URL changed (but didn't) while indexing conversations",
    [AutomationErrorType.x_runJob_indexMessages_OtherError]: "Error while indexing messages",
    [AutomationErrorType.x_runJob_indexMessages_ParseMessagesError]: "Failed to parse messages while indexing messages",
    [AutomationErrorType.x_runJob_archiveBuild_ArchiveBuildError]: "Failed to archive build",
    [AutomationErrorType.x_runJob_deleteTweets_FailedToStart]: "Failed to start deleting tweets",
    [AutomationErrorType.x_runJob_deleteTweets_WaitForMenuButtonFailed]: "Failed to wait for menu button while deleting tweets",
    [AutomationErrorType.x_runJob_deleteTweets_WaitForMenuFailed]: "Failed to wait for menu while deleting tweets",
    [AutomationErrorType.x_runJob_deleteTweets_WaitForDeleteConfirmationFailed]: "Failed to wait for delete confirmation popup while deleting tweets",
    [AutomationErrorType.x_runJob_UnknownError]: "An unknown error occured",
    [AutomationErrorType.x_runError]: "Error while in X run function",
    [AutomationErrorType.x_unknownError]: "An unknown error occured",
    [AutomationErrorType.x_loadURLError]: "Error while loading URL",
    [AutomationErrorType.x_loadURLURLChanged]: "URL changed after loading",
}

export type AutomationErrorDetails = {
    accountID: number;
    accountType: string;
    automationErrorType: AutomationErrorType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorReportData: any;
    username: string;
    screenshotDataURL: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sensitiveContextData: any;
}