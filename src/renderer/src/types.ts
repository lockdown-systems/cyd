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
    AUTOMATION_ERROR_OCCURED: 'Automation Error Occurred',
    AUTOMATION_ERROR_REPORT_SUBMITTED: 'Automation Error Report Submitted',
    AUTOMATION_ERROR_REPORT_NOT_SUBMITTED: 'Automation Error Report Not Submitted',
    AUTOMATION_ERROR_REPORT_ERROR: 'Automation Error Report Error',
    X_USER_SIGNED_IN: 'X User Signed In',
    X_ARCHIVE_STARTED: 'X Archive Started',
    X_ARCHIVE_COMPLETED: 'X Archive Completed',
    X_DELETE_STARTED: 'X Delete Started',
    X_DELETE_COMPLETED: 'X Delete Completed',
});
