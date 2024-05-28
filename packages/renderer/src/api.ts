export default class API {
    private apiUrl: string;

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
    }

    // Auth API

    async authenticate(request: AuthApiRequest): Promise<AuthApiResponse> {
        const response = await fetch(`${this.apiUrl}/authenticate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(request)
        });
        const data: AuthApiResponse = await response.json();
        return data;
    }

    async registerDevice(request: RegisterDeviceApiRequest): Promise<RegisterDeviceApiResponse> {
        const response = await fetch(`${this.apiUrl}/device`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(request)
        });
        const data: RegisterDeviceApiResponse = await response.json();
        return data;
    }

    async getToken(request: TokenApiRequest): Promise<TokenApiResponse> {
        const response = await fetch(`${this.apiUrl}/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(request)
        });
        const data: TokenApiResponse = await response.json();
        return data;
    }

    async logout(): Promise<LogoutApiResponse> {
        const response = await fetch(`${this.apiUrl}/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });
        const data: LogoutApiResponse = await response.json();
        return data;
    }

    async deleteDevice(request: DeleteDeviceApiRequest): Promise<void> {
        await fetch(`${this.apiUrl}/device`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(request)
        });
    }

    async ping(): Promise<boolean> {
        const response = await fetch(`${this.apiUrl}/ping`, {
            method: "GET"
        });
        return (response.status == 200);
    }
}