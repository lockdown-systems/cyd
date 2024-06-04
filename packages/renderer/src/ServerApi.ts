export default class ServerAPI {
    private apiUrl: string | null = null;
    private userEmail: string | null = null;
    private deviceToken: string | null = null;
    private apiToken: string | null = null;

    constructor() { }

    async initialize(): Promise<void> {
        this.apiUrl = await (window as any).electron.getApiUrl();
    }

    setUserEmail(userEmail: string) {
        this.userEmail = userEmail;
    }

    setDeviceToken(deviceToken: string) {
        this.deviceToken = deviceToken;
    }

    returnError(message: string) {
        let apiErrorResponse: ApiErrorResponse = {
            error: true,
            message: message
        }
        return apiErrorResponse
    }

    fetch(resource: RequestInfo, options: RequestInit): Promise<Response> {
        return new Promise((resolve, reject) => {
            fetch(resource, options).then(response => {
                if (response.status === 401) {
                    console.log("Invalid API token, trying to get a new one.")
                    // Try to get a new token
                    if (typeof this.userEmail === 'string' && typeof this.deviceToken === 'string') {
                        this.getToken({
                            email: this.userEmail,
                            deviceToken: this.deviceToken
                        }).then(tokenApiResponse => {
                            if ("error" in tokenApiResponse) {
                                reject(new Error('Unauthorized'));
                            } else {
                                // Try the request again
                                console.log("Trying the request again")
                                this.apiToken = tokenApiResponse.token;
                                fetch(resource, options).then(resolve, reject);
                            }
                        }, reject);
                    } else {
                        reject(new Error('Unauthorized'));
                    }
                } else {
                    resolve(response);
                }
            }, reject);
        });
    }

    async getNewApiToken(): Promise<boolean> {
        if (typeof this.userEmail === 'string' && typeof this.deviceToken === 'string') {
            const getTokenResp = await this.getToken({
                email: this.userEmail,
                deviceToken: this.deviceToken
            });
            if ("error" in getTokenResp) {
                console.log("Failed to get a new API token", getTokenResp.message);
                return false;
            }
            this.apiToken = getTokenResp.token;
            return true;
        }
        return false;
    }

    async validateApiToken(): Promise<boolean> {
        if (this.apiToken === null) {
            if (!await this.getNewApiToken()) {
                return false;
            }
        }
        return true;
    }

    // Auth API (not authenticated)

    async authenticate(request: AuthApiRequest): Promise<AuthApiResponse | ApiErrorResponse> {
        console.log("POST /authenticate");
        try {
            const response = await this.fetch(`${this.apiUrl}/authenticate`, {
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
            const response = await this.fetch(`${this.apiUrl}/device`, {
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
            const response = await this.fetch(`${this.apiUrl}/token`, {
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

            this.apiToken = data.token;
            return data;
        } catch {
            return this.returnError("Failed to get token with the server. Maybe the server is down?")
        }
    }

    // Auth API (authenticated)

    async logout(): Promise<LogoutApiResponse | ApiErrorResponse> {
        console.log("POST /logout");
        if (!await this.validateApiToken()) {
            return this.returnError("Failed to get a new API token.")
        }
        try {
            const response = await this.fetch(`${this.apiUrl}/logout`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + this.apiToken
                }
            });
            if (response.status != 200) {
                return this.returnError("Failed to logout with the server. Got status code " + response.status + ".")
            }

            this.apiToken = null;
            const data: LogoutApiResponse = await response.json();
            return data;
        } catch {
            return this.returnError("Failed to logout with the server. Maybe the server is down?")
        }
    }

    async deleteDevice(request: DeleteDeviceApiRequest): Promise<void | ApiErrorResponse> {
        console.log("DELETE /device");
        if (!await this.validateApiToken()) {
            return this.returnError("Failed to get a new API token.")
        }
        try {
            const response = await this.fetch(`${this.apiUrl}/device`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + this.apiToken
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
        if (!await this.validateApiToken()) {
            console.log("Failed to get a new API token.")
            return false;
        }
        try {
            const response = await this.fetch(`${this.apiUrl}/ping`, {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + this.apiToken
                }
            });
            return (response.status == 200);
        } catch {
            return false;
        }
    }
}