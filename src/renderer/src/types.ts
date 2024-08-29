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
});

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

// API models for POST /api/v1/device
export type RegisterDeviceApiRequest = {
    email: string;
    verification_code: string;
    description: string;
};

export type RegisterDeviceApiResponse = {
    uuid: string;
    device_token: string;
};

// API models for GET /api/v1/devices (an array of these)
export type GetDevicesApiResponse = {
    uuid: string;
    description: string;
    last_accessed_at: Date;
};

export type GetDevicesApiResponseArray = {
    devices: GetDevicesApiResponse[];
};

// API models for POST /api/v1/token
export type TokenApiRequest = {
    email: string;
    device_token: string;
};

export type TokenApiResponse = {
    api_token: string;
    email: string;
};

// API models for DELETE /api/v1/device
export type DeleteDeviceApiRequest = {
    uuid: string;
};