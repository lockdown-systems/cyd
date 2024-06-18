export type DeviceInfo = {
    userEmail: string;
    deviceDescription: string;
    deviceToken: string;
    deviceUUID: string;
    apiToken: string;
    valid: boolean;
};

export type XAccount = {
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

// API types below

// API error response
export type ApiErrorResponse = {
    error: boolean;
    message: string;
};

// API models for POST /api/v1/authenticate
export type AuthApiRequest = {
    email: string;
};

export type AuthApiResponse = {
    message: string;
};

// API models for POST /api/v1/device
export type RegisterDeviceApiRequest = {
    email: string;
    verificationCode: string;
    description: string;
};

export type RegisterDeviceApiResponse = {
    uuid: string;
    deviceToken: string;
};

// API models for GET /api/v1/devices (an array of these)
export type GetDevicesApiResponse = {
    uuid: string;
    description: string;
    lastAccessedAt: Date;
};

export type GetDevicesApiResponseArray = {
    devices: GetDevicesApiResponse[];
};

// API models for POST /api/v1/token
export type TokenApiRequest = {
    email: string;
    deviceToken: string;
};

export type TokenApiResponse = {
    expiration: Date;
    token: string;
    email: string;
};

// API models for POST /api/v1/logout
export type LogoutApiResponse = {
    message: string;
};

// API models for DELETE /api/v1/device
export type DeleteDeviceApiRequest = {
    uuid: string;
};