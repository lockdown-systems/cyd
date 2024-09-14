export enum AutomationErrorType {
    X_login_FailedToGetUsername = "X_login_FailedToGetUsername",
    x_runJob_indexTweets_Timeout = "x_runJob_indexTweets_Timeout",
    x_runJob_indexTweets_URLChanged = "x_runJob_indexTweets_URLChanged",
    x_runJob_indexTweets_OtherError = "x_runJob_indexTweets_OtherError",
    x_runJob_indexTweets_FailedToRetryAfterRateLimit = "x_runJob_indexTweets_FailedToRetryAfterRateLimit",
    x_runJob_indexConversations_Timeout = "x_runJob_indexConversations_Timeout",
    x_runJob_indexConversations_URLChanged = "x_runJob_indexConversations_URLChanged",
    x_runJob_indexConversations_OtherError = "x_runJob_indexConversations_OtherError",
}