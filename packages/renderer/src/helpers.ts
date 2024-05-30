import API from './ServerApi';

// This function checks to see if there's a userEmail and deviceToken, and if so if the
// deviceToken is valid. The email could still be there, even if the token is invalid.
export async function getDeviceInfo(api: API): Promise<DeviceInfo> {
    let deviceInfo: DeviceInfo = {
        "userEmail": "",
        "deviceDescription": "",
        "deviceToken": "",
        "apiToken": "",
        "valid": false
    };

    const deviceDescription = await (window as any).api.getConfig("deviceDescription");
    if (!deviceDescription) {
        // This should never happen
        deviceInfo["deviceDescription"] = "Unknown device";
    } else {
        deviceInfo["deviceDescription"] = deviceDescription;
    }

    const userEmail = await (window as any).api.getConfig("userEmail");
    if (userEmail) {
        deviceInfo["userEmail"] = userEmail;

        const deviceToken = await (window as any).api.getConfig("deviceToken");
        if (deviceToken && deviceToken.length > 0) {
            deviceInfo["deviceToken"] = deviceToken;

            // Do we already have a valid API token?
            const apiToken = await (window as any).api.getConfig("apiToken");
            if (apiToken && apiToken.length > 0) {
                deviceInfo["apiToken"] = apiToken;

                // Check if the API token is valid
                if (await api.ping()) {
                    deviceInfo["valid"] = true;
                }
            }

            // If we don't have a valid API token, get a new one
            if (!deviceInfo["valid"]) {
                try {
                    const tokenApiResponse = await api.getToken({
                        email: deviceInfo["userEmail"],
                        deviceToken: deviceInfo["deviceToken"]
                    })
                    if ("error" in tokenApiResponse) {
                        console.error("Error getting API token", tokenApiResponse.message);
                        deviceInfo["deviceToken"] = "";
                        (window as any).api.setConfig("deviceToken", "");
                        (window as any).api.setConfig("apiToken", "");
                    } else {
                        deviceInfo["apiToken"] = tokenApiResponse.token;
                        deviceInfo["valid"] = true;
                        (window as any).api.setConfig("apiToken", deviceInfo["apiToken"]);
                    }
                } catch (error) {
                    console.error("Error getting API token", error);
                    deviceInfo["deviceToken"] = "";
                    (window as any).api.setConfig("deviceToken", "");
                    (window as any).api.setConfig("apiToken", "");
                }
            }
        }
    }
    return deviceInfo;
}
