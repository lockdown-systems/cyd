import { expect, test, vi } from 'vitest'
import ServerAPI from './ServerApi'

// Mock the electron IPC API
vi.stubGlobal('window', {
    electron: {
        getApiUrl: vi.fn(() => 'https://mock/api/v1')
    }
});

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
function createFetchResponse(status: number, data: any) {
    return {
        status: status,
        headers: { 'Content-type': 'application/json' },
        json: () => new Promise((resolve) => resolve(data))
    }
}

test('ServerAPI.initialize() sets apiUrl', async () => {
    const serverApi = new ServerAPI();
    await serverApi.initialize();
    expect((window as any).electron.getApiUrl).toHaveBeenCalled();
})

test('ServerAPI.fetch() should set method and headers', async () => {
    const serverApi = new ServerAPI();
    await serverApi.initialize();

    await serverApi.fetch("DELETE", 'https://mock/api/v1/test', { test: 'data' });
    expect(mockFetch).toHaveBeenCalledWith('https://mock/api/v1/test', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            test: 'data'
        })
    });
})

test('ServerAPI.fetchAuthenticated() should send API token in headers', async () => {
    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-device-token';

    const serverApi = new ServerAPI();
    await serverApi.initialize();
    serverApi.setUserEmail(userEmail);
    serverApi.setDeviceToken(deviceToken);

    // Get an API token
    const mockTokenApiResponse = {
        expiration: new Date(),
        token: 'this-is-a-new-api-token',
        email: userEmail
    };
    mockFetch.mockResolvedValue(createFetchResponse(200, mockTokenApiResponse))

    const result = await serverApi.getNewApiToken();
    expect(result).toBe(true);

    // Make an authenticated response
    await serverApi.fetchAuthenticated("DELETE", 'https://mock/api/v1/test', { test: 'data' });
    expect(mockFetch).toHaveBeenCalledWith('https://mock/api/v1/test', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer this-is-a-new-api-token'
        },
        body: JSON.stringify({
            test: 'data'
        })
    });
})

test('ServerAPI.getNewApiToken() returns true on valid device token', async () => {
    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-device-token';

    const serverApi = new ServerAPI();
    await serverApi.initialize();
    serverApi.setUserEmail(userEmail);
    serverApi.setDeviceToken(deviceToken);

    const mockTokenApiResponse = {
        expiration: new Date(),
        token: 'this-is-a-new-api-token',
        email: userEmail
    };
    mockFetch.mockResolvedValue(createFetchResponse(200, mockTokenApiResponse))

    const result = await serverApi.getNewApiToken();
    expect(mockFetch).toHaveBeenCalledWith('https://mock/api/v1/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: userEmail,
            deviceToken: deviceToken
        })
    });

    expect(result).toBe(true);
});

test('ServerAPI.getNewApiToken() returns false on invalid device token', async () => {
    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-BAD-device-token';

    const serverApi = new ServerAPI();
    await serverApi.initialize();
    serverApi.setUserEmail(userEmail);
    serverApi.setDeviceToken(deviceToken);

    const mockErrorResponse = {
        message: 'Authentication failed'
    };
    mockFetch.mockResolvedValue(createFetchResponse(401, mockErrorResponse))

    const result = await serverApi.getNewApiToken();
    expect(mockFetch).toHaveBeenCalledWith('https://mock/api/v1/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: userEmail,
            deviceToken: deviceToken
        })
    });

    expect(result).toBe(false);
});