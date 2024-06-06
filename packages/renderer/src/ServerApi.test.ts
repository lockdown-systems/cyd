import { expect, test, vi } from 'vitest'
import ServerAPI from './ServerAPI'

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

// API helper function tests

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
    mockFetch.mockClear();

    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-device-token';

    const serverApi = new ServerAPI();
    await serverApi.initialize();
    serverApi.setUserEmail(userEmail);
    serverApi.setDeviceToken(deviceToken);

    // Get an API token
    mockFetch.mockResolvedValue(createFetchResponse(200, {
        expiration: new Date(),
        token: 'this-is-a-new-api-token',
        email: userEmail
    }))

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

test('ServerAPI.fetchAuthenticated() with good device token but not API token should fail the first time but work the second', async () => {
    mockFetch.mockClear();

    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-device-token';

    const serverApi = new ServerAPI();
    await serverApi.initialize();
    serverApi.setUserEmail(userEmail);
    serverApi.setDeviceToken(deviceToken);

    // The first time we try to fetch, we will get a 401 error
    mockFetch.mockResolvedValueOnce(createFetchResponse(401, {
        message: 'Authentication failed'
    }));
    // The second time we try to fetch, we will get a 200 response with an API token
    mockFetch.mockResolvedValueOnce(createFetchResponse(200, {
        expiration: new Date(),
        token: 'this-is-a-new-api-token',
        email: userEmail
    }));
    // Set the default response to 200 OK
    mockFetch.mockResolvedValue(createFetchResponse(200, {}));

    const response = await serverApi.fetchAuthenticated("DELETE", 'https://mock/api/v1/test', { test: 'data' });
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
});

test('ServerAPI.fetchAuthenticated() with bad device token and no API token should fail', async () => {
    mockFetch.mockClear();

    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-BAD-device-token';

    const serverApi = new ServerAPI();
    await serverApi.initialize();
    serverApi.setUserEmail(userEmail);
    serverApi.setDeviceToken(deviceToken);

    // Always return with authentication failed
    mockFetch.mockResolvedValue(createFetchResponse(401, {
        message: 'Authentication failed'
    }));

    const response = await serverApi.fetchAuthenticated("DELETE", 'https://mock/api/v1/test', { test: 'data' });
    expect(response.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(2);
});

test('ServerAPI.getNewApiToken() returns true on valid device token', async () => {
    mockFetch.mockClear();

    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-device-token';

    const serverApi = new ServerAPI();
    await serverApi.initialize();
    serverApi.setUserEmail(userEmail);
    serverApi.setDeviceToken(deviceToken);

    mockFetch.mockResolvedValue(createFetchResponse(200, {
        expiration: new Date(),
        token: 'this-is-a-new-api-token',
        email: userEmail
    }));

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
    mockFetch.mockClear();

    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-BAD-device-token';

    const serverApi = new ServerAPI();
    await serverApi.initialize();
    serverApi.setUserEmail(userEmail);
    serverApi.setDeviceToken(deviceToken);

    mockFetch.mockResolvedValue(createFetchResponse(401, {
        message: 'Authentication failed'
    }))

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

// Authentication tests

