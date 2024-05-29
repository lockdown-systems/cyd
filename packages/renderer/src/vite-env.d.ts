/// <reference types="vite/client" />

type DeviceInfo = {
    userEmail: string;
    deviceDescription: string;
    deviceToken: string;
    apiToken: string;
    valid: boolean;
};

// API error response
type ApiErrorResponse = {
    error: boolean;
    message: string;
};

// API models for POST /api/v1/authenticate
type AuthApiRequest = {
    email: string;
};

type AuthApiResponse = {
    message: string;
};

// API models for POST /api/v1/device
type RegisterDeviceApiRequest = {
    email: string;
    verificationCode: string;
    description: string;
};

type RegisterDeviceApiResponse = {
    deviceToken: string;
};

// API models for POST /api/v1/token
type TokenApiRequest = {
    email: string;
    deviceToken: string;
};

type TokenApiResponse = {
    expiration: Date;
    token: string;
    email: string;
};

// API models for POST /api/v1/logout
type LogoutApiResponse = {
    message: string;
};

// API models for DELETE /api/v1/device
type DeleteDeviceApiRequest = {
    deviceToken: string;
};