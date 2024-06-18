import ServerAPI from './ServerAPI';

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

    const serverApi = new ServerAPI();
    await serverApi.initialize();

    const deviceDescription = await window.electron.getConfig("deviceDescription");
    if (!deviceDescription) {
        // This should never happen
        deviceInfo["deviceDescription"] = "Unknown device";
    } else {
        deviceInfo["deviceDescription"] = deviceDescription;
    }

    const userEmail = await window.electron.getConfig("userEmail");
    if (userEmail) {
        deviceInfo["userEmail"] = userEmail;

        const deviceToken = await window.electron.getConfig("deviceToken");
        if (deviceToken && deviceToken.length > 0) {
            deviceInfo["deviceToken"] = deviceToken;

            const deviceUUID = await window.electron.getConfig("deviceUUID");
            if (deviceUUID) {
                deviceInfo["deviceUUID"] = deviceUUID;
            }

            serverApi.setUserEmail(userEmail);
            serverApi.setDeviceToken(deviceToken);
            const pingResp = await serverApi.ping();
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
