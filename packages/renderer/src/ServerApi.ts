function fetchWithTimeout(resource: RequestInfo, options: RequestInit, timeout = 5000): Promise<Response> {
    return new Promise((resolve, reject) => {
        fetch(resource, options).then(resolve, reject);
        setTimeout(reject, timeout, new Error('Request timed out'));
    });
}

export default class ServerAPI {
    private apiUrl: string;

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
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
        try {
            const response = await fetchWithTimeout(`${this.apiUrl}/authenticate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(request)
            });
            const data: AuthApiResponse = await response.json();
            return data;
        } catch {
            // Why isn't this getting caught?
            return this.returnError("Failed to authenticate with the server. Maybe the server is down?")
        }
    }

    async registerDevice(request: RegisterDeviceApiRequest): Promise<RegisterDeviceApiResponse | ApiErrorResponse> {
        const response = await fetchWithTimeout(`${this.apiUrl}/device`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(request)
        });
        const data: RegisterDeviceApiResponse = await response.json();
        return data;
    }

    async getToken(request: TokenApiRequest): Promise<TokenApiResponse | ApiErrorResponse> {
        const response = await fetchWithTimeout(`${this.apiUrl}/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(request)
        });
        const data: TokenApiResponse = await response.json();
        return data;
    }

    async logout(): Promise<LogoutApiResponse | ApiErrorResponse> {
        const response = await fetchWithTimeout(`${this.apiUrl}/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });
        const data: LogoutApiResponse = await response.json();
        return data;
    }

    async deleteDevice(request: DeleteDeviceApiRequest): Promise<void | ApiErrorResponse> {
        await fetchWithTimeout(`${this.apiUrl}/device`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(request)
        });
    }

    async ping(): Promise<boolean | ApiErrorResponse> {
        const response = await fetchWithTimeout(`${this.apiUrl}/ping`, {
            method: "GET"
        });
        return (response.status == 200);
    }
}