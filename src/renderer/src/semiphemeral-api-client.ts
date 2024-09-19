// API error response
export type ApiErrorResponse = {
    error: boolean;
    message: string;
};

// API models for POST /authenticate
export type AuthApiRequest = {
    email: string;
};

// API models for POST /device
export type RegisterDeviceApiRequest = {
    email: string;
    verification_code: string;
    description: string;
};

export type RegisterDeviceApiResponse = {
    uuid: string;
    device_token: string;
};

// API models for GET /device (an array of these)
export type GetDevicesApiResponse = {
    uuid: string;
    description: string;
    last_accessed_at: Date;
};

export type GetDevicesApiResponseArray = {
    devices: GetDevicesApiResponse[];
};

// API models for POST /token
export type TokenApiRequest = {
    email: string;
    device_token: string;
};

export type TokenApiResponse = {
    api_token: string;
    email: string;
};

// API models for DELETE /device
export type DeleteDeviceApiRequest = {
    uuid: string;
};

// API models for POST /x-progress
export type PostXProgressApiRequest = {
    account_uuid: string;
    total_tweets_archived: number;
    total_messages_indexed: number;
    total_tweets_deleted: number;
    total_retweets_deleted: number;
    total_likes_deleted: number;
    total_messages_deleted: number;
};

export default class SemiphemeralAPIClient {
    public apiURL: string | null = null;
    private userEmail: string | null = null;
    private deviceToken: string | null = null;
    private apiToken: string | null = null;

    constructor() { }

    initialize(APIURL: string): void {
        this.apiURL = APIURL;
    }

    setUserEmail(userEmail: string) {
        this.userEmail = userEmail;
    }

    setDeviceToken(deviceToken: string) {
        this.deviceToken = deviceToken;
    }

    returnError(message: string) {
        const apiErrorResponse: ApiErrorResponse = {
            error: true,
            message: message
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
                this.getNewApiToken().then(success => {
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

    async getNewApiToken(): Promise<boolean> {
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

    async validateApiToken(): Promise<boolean> {
        if (typeof this.apiToken === 'string') {
            return true;
        }
        return await this.getNewApiToken();
    }

    // Auth API (not authenticated)

    async authenticate(request: AuthApiRequest): Promise<boolean | ApiErrorResponse> {
        console.log("POST /authenticate");
        try {
            const response = await this.fetch("POST", `${this.apiURL}/authenticate`, request);
            if (response.status != 200) {
                return this.returnError("Failed to authenticate with the server. Got status code " + response.status + ".")
            }
            return true;
        } catch {
            return this.returnError("Failed to authenticate with the server. Maybe the server is down?")
        }
    }

    async registerDevice(request: RegisterDeviceApiRequest): Promise<RegisterDeviceApiResponse | ApiErrorResponse> {
        console.log("POST /device");
        try {
            const response = await this.fetch("POST", `${this.apiURL}/device`, request);
            if (response.status != 200) {
                return this.returnError("Failed to register device with the server. Got status code " + response.status + ".")
            }
            const data: RegisterDeviceApiResponse = await response.json();
            return data;
        } catch {
            return this.returnError("Failed to register device with the server. Maybe the server is down?")
        }

    }

    async getToken(request: TokenApiRequest): Promise<TokenApiResponse | ApiErrorResponse> {
        console.log("POST /token");
        try {
            const response = await this.fetch("POST", `${this.apiURL}/token`, request);
            if (response.status != 200) {
                return this.returnError("Failed to get token with the server. Got status code " + response.status + ".")
            }
            const data: TokenApiResponse = await response.json();

            this.apiToken = data.api_token;
            return data;
        } catch {
            return this.returnError("Failed to get token with the server. Maybe the server is down?")
        }
    }

    // Auth API (authenticated)

    async deleteDevice(request: DeleteDeviceApiRequest): Promise<void | ApiErrorResponse> {
        console.log("DELETE /device");
        if (!await this.validateApiToken()) {
            return this.returnError("Failed to get a new API token.")
        }
        try {
            const response = await this.fetchAuthenticated("DELETE", `${this.apiURL}/device`, request);
            if (response.status != 200) {
                return this.returnError("Failed to delete device with the server. Got status code " + response.status + ".")
            }
        } catch {
            return this.returnError("Failed to delete device with the server. Maybe the server is down?")
        }
    }

    async getDevices(): Promise<GetDevicesApiResponseArray | ApiErrorResponse> {
        console.log("GET /device");
        if (!await this.validateApiToken()) {
            return this.returnError("Failed to get a new API token.")
        }
        try {
            const response = await this.fetchAuthenticated("GET", `${this.apiURL}/device`, null);
            if (response.status != 200) {
                return this.returnError("Failed to get devices. Got status code " + response.status + ".")
            }
            const data: GetDevicesApiResponse[] = await response.json();
            return { devices: data };
        } catch {
            return this.returnError("Failed to get devices. Maybe the server is down?")
        }
    }

    async ping(): Promise<boolean> {
        console.log("GET /ping");
        if (!await this.validateApiToken()) {
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

    async postXProgress(request: PostXProgressApiRequest, authenticated: boolean): Promise<boolean | ApiErrorResponse> {
        console.log("POST /x-progress", request);

        try {
            let response: Response;
            if (authenticated) {
                // Use the authenticated fetch function
                if (!await this.validateApiToken()) {
                    return this.returnError("Failed to get a new API token.")
                }

                response = await this.fetchAuthenticated("POST", `${this.apiURL}/x-progress`, request);
            } else {
                // Use the unauthenticated fetch function if we don't have an API token
                response = await this.fetch("POST", `${this.apiURL}/x-progress`, request);
            }

            if (response.status != 200) {
                return this.returnError("Failed to post XProgress with the server. Got status code " + response.status + ".")
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
}
