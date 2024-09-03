export type DeviceInfo = {
    userEmail: string;
    deviceDescription: string;
    deviceToken: string;
    deviceUUID: string;
    apiToken: string;
    valid: boolean;
};

export const PlausibleEvents = Object.freeze({
    APP_OPENED: 'App Opened',
    X_USER_SIGNED_IN: 'X User Signed In',
    X_ARCHIVE_STARTED: 'X Archive Started',
    X_ARCHIVE_COMPLETED: 'X Archive Completed',
    X_DELETE_STARTED: 'X Delete Started',
    X_DELETE_COMPLETED: 'X Delete Completed',
});

// API types below

// API error response
export type ApiErrorResponse = {
    error: boolean;
    message: string;
};

// API models for POST /authenticate
export type AuthApiRequest = {
    email: string;
};

// API models for POST /device
export type RegisterDeviceApiRequest = {
    email: string;
    verification_code: string;
    description: string;
};

export type RegisterDeviceApiResponse = {
    uuid: string;
    device_token: string;
};

// API models for GET /device (an array of these)
export type GetDevicesApiResponse = {
    uuid: string;
    description: string;
    last_accessed_at: Date;
};

export type GetDevicesApiResponseArray = {
    devices: GetDevicesApiResponse[];
};

// API models for POST /token
export type TokenApiRequest = {
    email: string;
    device_token: string;
};

export type TokenApiResponse = {
    api_token: string;
    email: string;
};

// API models for DELETE /device
export type DeleteDeviceApiRequest = {
    uuid: string;
};

// API models for POST /x-progress
export type PostXProgressApiRequest = {
    account_uuid: string;
    total_tweets_archived: number;
    total_messages_indexed: number;
    total_tweets_deleted: number;
    total_retweets_deleted: number;
    total_likes_deleted: number;
    total_messages_deleted: number;
};