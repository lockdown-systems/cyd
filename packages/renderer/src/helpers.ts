import ServerAPI from './ServerApi';

// This function checks to see if there's a userEmail and deviceToken, and if so if the
// deviceToken is valid. The email could still be there, even if the token is invalid.
export async function getDeviceInfo(): Promise<DeviceInfo> {
    let deviceInfo: DeviceInfo = {
        "userEmail": "",
        "deviceDescription": "",
        "deviceToken": "",
        "apiToken": "",
        "valid": false
    };

    const serverApi = new ServerAPI();
    await serverApi.initialize();

    const deviceDescription = await (window as any).electron.getConfig("deviceDescription");
    if (!deviceDescription) {
        // This should never happen
        deviceInfo["deviceDescription"] = "Unknown device";
    } else {
        deviceInfo["deviceDescription"] = deviceDescription;
    }

    const userEmail = await (window as any).electron.getConfig("userEmail");
    if (userEmail) {
        deviceInfo["userEmail"] = userEmail;

        const deviceToken = await (window as any).electron.getConfig("deviceToken");
        if (deviceToken && deviceToken.length > 0) {
            deviceInfo["deviceToken"] = deviceToken;

            // Do we already have a valid API token?
            const apiToken = await (window as any).electron.getConfig("apiToken");
            if (apiToken && apiToken.length > 0) {
                deviceInfo["apiToken"] = apiToken;

                // Check if the API token is valid
                const pingResp = await serverApi.ping();
                if (pingResp) {
                    deviceInfo["valid"] = true;
                }
            }

            // If we don't have a valid API token, get a new one
            if (!deviceInfo["valid"]) {
                try {
                    const tokenApiResponse = await serverApi.getToken({
                        email: deviceInfo["userEmail"],
                        deviceToken: deviceInfo["deviceToken"]
                    })
                    if ("error" in tokenApiResponse) {
                        console.error("Error getting API token", tokenApiResponse.message);
                        deviceInfo["deviceToken"] = "";
                        (window as any).electron.setConfig("deviceToken", "");
                        (window as any).electron.setConfig("apiToken", "");
                    } else {
                        deviceInfo["apiToken"] = tokenApiResponse.token;
                        deviceInfo["valid"] = true;
                        (window as any).electron.setConfig("apiToken", deviceInfo["apiToken"]);
                    }
                } catch (error) {
                    console.error("Error getting API token", error);
                    deviceInfo["deviceToken"] = "";
                    (window as any).electron.setConfig("deviceToken", "");
                    (window as any).electron.setConfig("apiToken", "");
                }
            }
        }
    }
    return deviceInfo;
}
