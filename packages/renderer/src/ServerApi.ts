function fetchWithTimeout(resource: RequestInfo, options: RequestInit, timeout = 5000): Promise<Response> {
    return new Promise((resolve, reject) => {
        fetch(resource, options).then(resolve, reject);
        setTimeout(reject, timeout, new Error('Request timed out'));
    });
}

export default class ServerAPI {
    private apiUrl: string | null = null;
    private token: string | null = null;

    constructor() { }

    async initialize(): Promise<void> {
        this.apiUrl = await (window as any).electron.getApiUrl();
    }

    setToken(token: string) {
        console.log("Setting device token");
        this.token = token;
    }

    returnError(message: string) {
        let apiErrorResponse: ApiErrorResponse = {
            error: true,
            message: message
        }
        return apiErrorResponse
    }

    // Auth API

    async authenticate(request: AuthApiRequest): Promise<AuthApiResponse | ApiErrorResponse> {
        console.log("POST /authenticate");
        try {
            const response = await fetchWithTimeout(`${this.apiUrl}/authenticate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(request)
            });
            if (response.status != 200) {
                return this.returnError("Failed to authenticate with the server. Got status code " + response.status + ".")
            }
            const data: AuthApiResponse = await response.json();
            return data;
        } catch {
            // Why isn't this getting caught?
            return this.returnError("Failed to authenticate with the server. Maybe the server is down?")
        }
    }

    async registerDevice(request: RegisterDeviceApiRequest): Promise<RegisterDeviceApiResponse | ApiErrorResponse> {
        console.log("POST /device");
        try {
            const response = await fetchWithTimeout(`${this.apiUrl}/device`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(request)
            });
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
            const response = await fetchWithTimeout(`${this.apiUrl}/token`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(request)
            });
            if (response.status != 200) {
                return this.returnError("Failed to get token with the server. Got status code " + response.status + ".")
            }
            const data: TokenApiResponse = await response.json();

            this.token = data.token;
            return data;
        } catch {
            return this.returnError("Failed to get token with the server. Maybe the server is down?")
        }
    }

    async logout(): Promise<LogoutApiResponse | ApiErrorResponse> {
        console.log("POST /logout");
        try {
            const response = await fetchWithTimeout(`${this.apiUrl}/logout`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + this.token
                }
            });
            if (response.status != 200) {
                return this.returnError("Failed to logout with the server. Got status code " + response.status + ".")
            }

            this.token = null;
            const data: LogoutApiResponse = await response.json();
            return data;
        } catch {
            return this.returnError("Failed to logout with the server. Maybe the server is down?")
        }
    }

    async deleteDevice(request: DeleteDeviceApiRequest): Promise<void | ApiErrorResponse> {
        console.log("DELETE /device");
        try {
            const response = await fetchWithTimeout(`${this.apiUrl}/device`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + this.token
                },
                body: JSON.stringify(request)
            });
            if (response.status != 200) {
                return this.returnError("Failed to delete device with the server. Got status code " + response.status + ".")
            }
        } catch {
            return this.returnError("Failed to delete device with the server. Maybe the server is down?")
        }
    }

    async ping(): Promise<boolean> {
        console.log("GET /ping");
        try {
            const response = await fetchWithTimeout(`${this.apiUrl}/ping`, {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + this.token
                }
            });
            return (response.status == 200);
        } catch {
            return false;
        }
    }
}