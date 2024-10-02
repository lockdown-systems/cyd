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
