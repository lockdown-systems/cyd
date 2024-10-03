// API error response
export type APIErrorResponse = {
    error: boolean;
    message: string;
    status?: number;
};

// API models for POST /authenticate
export type AuthAPIRequest = {
    email: string;
};

// API models for POST /device
export type RegisterDeviceAPIRequest = {
    email: string;
    verification_code: string;
    description: string;
};

export type RegisterDeviceAPIResponse = {
    uuid: string;
    device_token: string;
};

// API models for GET /device (an array of these)
export type GetDevicesAPIResponse = {
    uuid: string;
    description: string;
    last_accessed_at: Date;
};

export type GetDevicesAPIResponseArray = {
    devices: GetDevicesAPIResponse[];
};

// API models for POST /token
export type TokenAPIRequest = {
    email: string;
    device_token: string;
};

export type TokenAPIResponse = {
    api_token: string;
    device_uuid: string;
    email: string;
};

// API models for DELETE /device
export type DeleteDeviceAPIRequest = {
    uuid: string;
};

// API models for POST /x-progress
export type PostXProgressAPIRequest = {
    account_uuid: string;
    total_tweets_archived: number;
    total_messages_indexed: number;
    total_tweets_deleted: number;
    total_retweets_deleted: number;
    total_likes_deleted: number;
    total_messages_deleted: number;
};

// API models for GET /user/premium
export type UserPremiumAPIResponse = {
    premium_price_cents: number;
    premium_business_price_cents: number;
    premium_access: boolean;
    has_individual_subscription: boolean;
    subscription_cancel_at_period_end: boolean;
    subscription_current_period_end: string;
    has_business_subscription: boolean;
    business_organizations: string[];
};

// API models for POST /user/premium
export type PostUserPremiumAPIResponse = {
    redirect_url: string;
};

// API models for GET /user/stats
export type UserStatsAPIResponse = {
    total_tweets_archived: number;
    total_messages_indexed: number;
    total_tweets_deleted: number;
    total_retweets_deleted: number;
    total_likes_deleted: number;
    total_messages_deleted: number;
};

// API models for POST /automation-error-report
export type PostAutomationErrorReportAPIRequest = {
    app_version: string;
    client_platform: string;
    account_type: string;
    error_report_type: string;
    error_report_data: object;
    account_username?: string;
    screenshot_data_uri?: string;
    sensitive_context_data?: object;
};

// The API client
export default class SemiphemeralAPIClient {
    public apiURL: string | null = null;
    private userEmail: string | null = null;
    private deviceToken: string | null = null;
    private apiToken: string | null = null;
    private deviceUUID: string | null = null;

    constructor() {
        this.apiURL = null;
        this.userEmail = null;
        this.deviceToken = null;
        this.apiToken = null;
        this.deviceUUID = null;
    }

    initialize(APIURL: string): void {
        this.apiURL = APIURL;
    }

    setUserEmail(userEmail: string) {
        this.userEmail = userEmail;
    }

    setDeviceToken(deviceToken: string) {
        this.deviceToken = deviceToken;
    }

    getDeviceUUID(): string | null {
        return this.deviceUUID;
    }

    returnError(message: string, status?: number): APIErrorResponse {
        const apiErrorResponse: APIErrorResponse = {
            error: true,
            message: message,
            status: status
        }
        return apiErrorResponse
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetch(method: string, resource: RequestInfo, body: any): Promise<Response> {
        const options: RequestInit = {
            method: method,
            headers: {
                "Content-Type": "application/json"
            }
        };
        if (body !== null) {
            options.body = JSON.stringify(body);
        }
        return fetch(resource, options);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchAuthenticated(method: string, resource: RequestInfo, body: any): Promise<Response> {
        const options: RequestInit = {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + this.apiToken
            }
        };
        if (body !== null) {
            options.body = JSON.stringify(body);
        }
        return new Promise((resolve, reject) => {
            fetch(resource, options).then(response => {
                if (response.status != 401) {
                    resolve(response);
                    return;
                }

                // Try to get a new token, and then try one more time
                console.log("Failed to authenticate with the server. Trying to get a new API token.");
                this.getNewAPIToken().then(success => {
                    if (success) {
                        console.log("Got a new API token. Retrying the request.")
                        fetch(resource, options).then(resolve, reject);
                    } else {
                        console.log("Failed to get a new API token.")
                        resolve(new Response(JSON.stringify({ "message": "Authentication failed" }), {
                            status: 401,
                            headers: { 'Content-type': 'application/json' }
                        }));
                    }
                });
            }, reject);
        });
    }

    async getNewAPIToken(): Promise<boolean> {
        console.log("Getting a new API token");
        if (
            typeof this.userEmail === 'string' && this.userEmail != '' &&
            typeof this.deviceToken === 'string' && this.deviceToken != ''
        ) {
            const getTokenResp = await this.getToken({
                email: this.userEmail,
                device_token: this.deviceToken
            });
            if ("error" in getTokenResp) {
                console.log("Failed to get a new API token", getTokenResp.message);
                return false;
            }
            this.apiToken = getTokenResp.api_token;
            return true;
        }
        return false;
    }

    async validateAPIToken(): Promise<boolean> {
        if (typeof this.apiToken === 'string') {
            return true;
        }
        return await this.getNewAPIToken();
    }

    // Auth API (not authenticated)

    async authenticate(request: AuthAPIRequest): Promise<boolean | APIErrorResponse> {
        console.log("POST /authenticate");
        try {
            const response = await this.fetch("POST", `${this.apiURL}/authenticate`, request);
            if (response.status != 200) {
                return this.returnError("Failed to authenticate with the server.", response.status)
            }
            return true;
        } catch {
            return this.returnError("Failed to authenticate with the server. Maybe the server is down?")
        }
    }

    async registerDevice(request: RegisterDeviceAPIRequest): Promise<RegisterDeviceAPIResponse | APIErrorResponse> {
        console.log("POST /device");
        try {
            const response = await this.fetch("POST", `${this.apiURL}/device`, request);
            if (response.status != 200) {
                return this.returnError("Failed to register device with the server.", response.status)
            }
            const data: RegisterDeviceAPIResponse = await response.json();
            return data;
        } catch {
            return this.returnError("Failed to register device with the server. Maybe the server is down?")
        }

    }

    async getToken(request: TokenAPIRequest): Promise<TokenAPIResponse | APIErrorResponse> {
        console.log("POST /token");
        try {
            const response = await this.fetch("POST", `${this.apiURL}/token`, request);
            if (response.status != 200) {
                return this.returnError("Failed to get token with the server.", response.status)
            }
            const data: TokenAPIResponse = await response.json();

            this.apiToken = data.api_token;

            // Set the device UUID
            this.deviceUUID = data.device_uuid;
            return data;
        } catch {
            return this.returnError("Failed to get token with the server. Maybe the server is down?")
        }
    }

    // Auth API (authenticated)

    async deleteDevice(request: DeleteDeviceAPIRequest): Promise<void | APIErrorResponse> {
        console.log("DELETE /device");
        if (!await this.validateAPIToken()) {
            return this.returnError("Failed to get a new API token.")
        }
        try {
            const response = await this.fetchAuthenticated("DELETE", `${this.apiURL}/device`, request);
            if (response.status != 200) {
                return this.returnError("Failed to delete device with the server.", response.status)
            }
        } catch {
            return this.returnError("Failed to delete device with the server. Maybe the server is down?")
        }
    }

    async getDevices(): Promise<GetDevicesAPIResponseArray | APIErrorResponse> {
        console.log("GET /device");
        if (!await this.validateAPIToken()) {
            return this.returnError("Failed to get a new API token.")
        }
        try {
            const response = await this.fetchAuthenticated("GET", `${this.apiURL}/device`, null);
            if (response.status != 200) {
                return this.returnError("Failed to get devices.", response.status)
            }
            const data: GetDevicesAPIResponse[] = await response.json();
            return { devices: data };
        } catch {
            return this.returnError("Failed to get devices. Maybe the server is down?")
        }
    }

    async ping(): Promise<boolean> {
        console.log("GET /ping");
        if (!await this.validateAPIToken()) {
            console.log("Failed to get a new API token.")
            return false;
        }
        try {
            const response = await this.fetchAuthenticated("GET", `${this.apiURL}/ping`, null);
            return (response.status == 200);
        } catch {
            return false;
        }
    }

    // Submit progress

    async postXProgress(request: PostXProgressAPIRequest, authenticated: boolean): Promise<boolean | APIErrorResponse> {
        console.log("POST /x-progress", request);

        // Use the unauthenticated fetch function if we don't have an API token
        let fetchFunc = this.fetch;
        if (authenticated) {
            if (!await this.validateAPIToken()) {
                return this.returnError("Failed to get a new API token.")
            }
            fetchFunc = this.fetchAuthenticated;
        }

        try {
            const response = await fetchFunc("POST", `${this.apiURL}/x-progress`, request);
            if (response.status != 200) {
                return this.returnError("Failed to post XProgress with the server.", response.status)
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (error.response) {
                const statusCode = error.response.status;
                const responseBody = error.response.data;
                return this.returnError(`Failed to post XProgress with the server. Status code: ${statusCode}, Response body: ${JSON.stringify(responseBody)}`);
            } else if (error.request) {
                return this.returnError("Failed to post XProgress with the server. No response received.");
            } else {
                return this.returnError(`Failed to post XProgress with the server. Error: ${error.message}`);
            }
        }

        return true;
    }

    // User API (authenticated)

    async getUserPremium(): Promise<UserPremiumAPIResponse | APIErrorResponse> {
        console.log("GET /user/premium");
        if (!await this.validateAPIToken()) {
            return this.returnError("Failed to get a new API token.")
        }
        try {
            const response = await this.fetchAuthenticated("GET", `${this.apiURL}/user/premium`, null);
            if (response.status != 200) {
                return this.returnError("Failed to get user premium status.", response.status)
            }
            const data: UserPremiumAPIResponse = await response.json();
            return data;
        } catch {
            return this.returnError("Failed to get user premium status. Maybe the server is down?")
        }
    }

    async postUserPremium(): Promise<PostUserPremiumAPIResponse | APIErrorResponse> {
        console.log("POST /user/premium");
        if (!await this.validateAPIToken()) {
            return this.returnError("Failed to get a new API token.")
        }
        try {
            const response = await this.fetchAuthenticated("POST", `${this.apiURL}/user/premium`, null);
            if (response.status != 200) {
                return this.returnError("Failed to upgrade user to premium.", response.status)
            }
            const data: PostUserPremiumAPIResponse = await response.json();
            return data;
        } catch {
            return this.returnError("Failed to upgrade user to premium. Maybe the server is down?")
        }
    }

    async putUserPremium(action: string): Promise<boolean | APIErrorResponse> {
        console.log("PUT /user/premium");
        if (!await this.validateAPIToken()) {
            return this.returnError("Failed to get a new API token.")
        }
        try {
            const response = await this.fetchAuthenticated("PUT", `${this.apiURL}/user/premium`, { action: action });
            if (response.status != 200) {
                return this.returnError("Failed to update subscription.", response.status)
            }
            return true;
        } catch {
            return this.returnError("Failed to update subscription. Maybe the server is down?")
        }
    }

    async deleteUserPremium(): Promise<boolean | APIErrorResponse> {
        console.log("DELETE /user/premium");
        if (!await this.validateAPIToken()) {
            return this.returnError("Failed to get a new API token.")
        }
        try {
            const response = await this.fetchAuthenticated("DELETE", `${this.apiURL}/user/premium`, null);
            if (response.status != 200) {
                return this.returnError("Failed to cancel subscription.", response.status)
            }
            return true;
        } catch {
            return this.returnError("Failed to cancel subscription. Maybe the server is down?")
        }
    }

    async getUserStats(): Promise<UserStatsAPIResponse | APIErrorResponse> {
        console.log("GET /user/stats");
        if (!await this.validateAPIToken()) {
            return this.returnError("Failed to get a new API token.")
        }
        try {
            const response = await this.fetchAuthenticated("GET", `${this.apiURL}/user/stats`, null);
            if (response.status != 200) {
                return this.returnError("Failed to get user stats.", response.status)
            }
            const data: UserStatsAPIResponse = await response.json();
            return data;
        } catch {
            return this.returnError("Failed to get user stats. Maybe the server is down?")
        }
    }

    // Submit automation error report

    async postAutomationErrorReport(request: PostAutomationErrorReportAPIRequest, authenticated: boolean): Promise<boolean | APIErrorResponse> {
        console.log("POST /automation-error-report", request);

        // Use the unauthenticated fetch function if we don't have an API token
        let fetchFunc = this.fetch;
        if (authenticated) {
            if (!await this.validateAPIToken()) {
                return this.returnError("Failed to get a new API token.")
            }
            fetchFunc = this.fetchAuthenticated;
        }

        try {
            const response = await fetchFunc("POST", `${this.apiURL}/automation-error-report`, request);
            if (response.status != 200) {
                return this.returnError("Failed to post automation error report with the server.", response.status)
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (error.response) {
                const statusCode = error.response.status;
                const responseBody = error.response.data;
                return this.returnError(`Failed to post automation error report with the server. Status code: ${statusCode}, Response body: ${JSON.stringify(responseBody)}`);
            } else if (error.request) {
                return this.returnError("Failed to post automation error report with the server. No response received.");
            } else {
                return this.returnError(`Failed to post automation error report with the server. Error: ${error.message}`);
            }
        }

        return true;
    }
}
