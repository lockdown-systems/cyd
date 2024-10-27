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


export async function setAccountRunning(accountID: number, isRunning: boolean) {
    if (isRunning) {
        // Start power save blocker
        const powerSaveBlockerID = await window.electron.startPowerSaveBlocker();
        localStorage.setItem(`account-${accountID}-power-save-blocker-id`, JSON.stringify(powerSaveBlockerID));
    } else {
        // Stop power save blocker
        const powerSaveBlockerID = localStorage.getItem(`account-${accountID}-power-save-blocker-id`);
        if (powerSaveBlockerID) {
            window.electron.stopPowerSaveBlocker(JSON.parse(powerSaveBlockerID));
            localStorage.removeItem(`account-${accountID}-power-save-blocker-id`);
        }
    }

    localStorage.setItem(`account-${accountID}-running`, JSON.stringify(isRunning));
}

export async function getAccountRunning(accountID: number): Promise<boolean> {
    const isRunning = localStorage.getItem(`account-${accountID}-running`);
    return isRunning ? JSON.parse(isRunning) : false;
}

export async function openPreventSleepURL() {
    const platform = await window.electron.getPlatform();
    let url: string;
    if (platform === 'darwin') {
        url = 'https://semiphemeral.com/docs-disable-sleep-in-macos/';
    } else if (platform == 'win32') {
        url = 'https://semiphemeral.com/docs-disable-sleep-in-windows/';
    } else if (platform == 'linux') {
        url = 'https://semiphemeral.com/docs-disable-sleep-in-linux/';
    } else {
        url = 'https://semiphemeral.com/';
    }
    await window.electron.openURL(url);
}
