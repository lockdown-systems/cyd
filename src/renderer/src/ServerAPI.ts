import {
    ApiErrorResponse,
    AuthApiRequest,
    RegisterDeviceApiRequest,
    RegisterDeviceApiResponse,
    TokenApiRequest,
    TokenApiResponse,
    DeleteDeviceApiRequest,
    GetDevicesApiResponse,
    GetDevicesApiResponseArray
} from "./types";

export default class ServerAPI {
    private apiUrl: string | null = null;
    private userEmail: string | null = null;
    private deviceToken: string | null = null;
    private apiToken: string | null = null;

    constructor() { }

    async initialize(): Promise<void> {
        this.apiUrl = await window.electron.getAPIURL();
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
        if (typeof this.userEmail === 'string' && typeof this.deviceToken === 'string') {
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
            const response = await this.fetch("POST", `${this.apiUrl}/authenticate`, request);
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
            const response = await this.fetch("POST", `${this.apiUrl}/device`, request);
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
            const response = await this.fetch("POST", `${this.apiUrl}/token`, request);
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
            const response = await this.fetchAuthenticated("DELETE", `${this.apiUrl}/device`, request);
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
            const response = await this.fetchAuthenticated("GET", `${this.apiUrl}/device`, null);
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
            const response = await this.fetchAuthenticated("GET", `${this.apiUrl}/ping`, null);
            return (response.status == 200);
        } catch {
            return false;
        }
    }
}