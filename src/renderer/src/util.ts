import SemiphemeralAPIClient from '../../semiphemeral-api-client';
import type { DeviceInfo } from './types';

// This function checks to see if there's a userEmail and deviceToken, and if so if the
// deviceToken is valid. The email could still be there, even if the token is invalid.
export async function getDeviceInfo(): Promise<DeviceInfo> {
    const deviceInfo: DeviceInfo = {
        "userEmail": "",
        "deviceDescription": "",
        "deviceToken": "",
        "deviceUUID": "",
        "apiToken": "",
        "valid": false
    };

    const apiClient = new SemiphemeralAPIClient();
    apiClient.initialize(await window.electron.getAPIURL());

    const deviceDescription = await window.electron.database.getConfig("deviceDescription");
    if (!deviceDescription) {
        // This should never happen
        deviceInfo["deviceDescription"] = "Unknown device";
    } else {
        deviceInfo["deviceDescription"] = deviceDescription;
    }

    const userEmail = await window.electron.database.getConfig("userEmail");
    if (userEmail) {
        deviceInfo["userEmail"] = userEmail;

        const deviceToken = await window.electron.database.getConfig("deviceToken");
        if (deviceToken && deviceToken.length > 0) {
            deviceInfo["deviceToken"] = deviceToken;

            const deviceUUID = await window.electron.database.getConfig("deviceUUID");
            if (deviceUUID) {
                deviceInfo["deviceUUID"] = deviceUUID;
            }

            apiClient.setUserEmail(userEmail);
            apiClient.setDeviceToken(deviceToken);
            const pingResp = await apiClient.ping();
            if (pingResp) {
                deviceInfo["valid"] = true;
                console.log("Device is valid");
            } else {
                console.log("Device is invalid");
            }
        }
    } else {
        console.log("No userEmail found in config");
    }
    return deviceInfo;
}

export function getAccountIcon(accountType: string): string {
    switch (accountType) {
        case "X":
            return "fa-brands fa-x-twitter";
        default:
            return "fa-solid fa-gears";
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logObj(obj: any) {
    return JSON.parse(JSON.stringify(obj));
}