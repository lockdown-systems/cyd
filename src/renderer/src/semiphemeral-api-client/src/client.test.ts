import { expect, test, vi } from 'vitest'
import SemiphemeralAPIClient from './client'

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

type FetchResponseData = {
    api_token?: string;
    email?: string;
    message?: string;
};

const mockAPIURL = 'https://mock/api';

function createFetchResponse(status: number, data: FetchResponseData) {
    return {
        status: status,
        headers: { 'Content-type': 'application/json' },
        json: () => new Promise((resolve) => resolve(data))
    }
}

// API helper function tests

test('SemiphemeralAPIClient.initialize() sets apiURL', async () => {
    const client = new SemiphemeralAPIClient();
    await client.initialize(mockAPIURL);
    expect(client.apiURL).toBe(mockAPIURL);
})

test('SemiphemeralAPIClient.fetch() should set method and headers', async () => {
    const client = new SemiphemeralAPIClient();
    await client.initialize(mockAPIURL);

    await client.fetch("DELETE", 'https://mock/api/test', { test: 'data' });
    expect(mockFetch).toHaveBeenCalledWith('https://mock/api/test', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            test: 'data'
        })
    });
})

test('SemiphemeralAPIClient.fetchAuthenticated() should send API token in headers', async () => {
    mockFetch.mockClear();

    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-device-token';

    const client = new SemiphemeralAPIClient();
    await client.initialize(mockAPIURL);
    client.setUserEmail(userEmail);
    client.setDeviceToken(deviceToken);

    // Get an API token
    mockFetch.mockResolvedValue(createFetchResponse(200, {
        api_token: 'this-is-a-new-api-token',
        email: userEmail
    }))

    const result = await client.getNewApiToken();
    expect(result).toBe(true);

    // Make an authenticated response
    await client.fetchAuthenticated("DELETE", 'https://mock/api/test', { test: 'data' });
    expect(mockFetch).toHaveBeenCalledWith('https://mock/api/test', {
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

test('SemiphemeralAPIClient.fetchAuthenticated() with good device token but not API token should fail the first time but work the second', async () => {
    mockFetch.mockClear();

    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-device-token';

    const client = new SemiphemeralAPIClient();
    await client.initialize(mockAPIURL);
    client.setUserEmail(userEmail);
    client.setDeviceToken(deviceToken);

    // The first time we try to fetch, we will get a 401 error
    mockFetch.mockResolvedValueOnce(createFetchResponse(401, {
        message: 'Authentication failed'
    }));
    // The second time we try to fetch, we will get a 200 response with an API token
    mockFetch.mockResolvedValueOnce(createFetchResponse(200, {
        api_token: 'this-is-a-new-api-token',
        email: userEmail
    }));
    // Set the default response to 200 OK
    mockFetch.mockResolvedValue(createFetchResponse(200, {}));

    const response = await client.fetchAuthenticated("DELETE", 'https://mock/api/test', { test: 'data' });
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
});

test('SemiphemeralAPIClient.fetchAuthenticated() with bad device token and no API token should fail', async () => {
    mockFetch.mockClear();

    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-BAD-device-token';

    const client = new SemiphemeralAPIClient();
    await client.initialize(mockAPIURL);
    client.setUserEmail(userEmail);
    client.setDeviceToken(deviceToken);

    // Always return with authentication failed
    mockFetch.mockResolvedValue(createFetchResponse(401, {
        message: 'Authentication failed'
    }));

    const response = await client.fetchAuthenticated("DELETE", 'https://mock/api/test', { test: 'data' });
    expect(response.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(2);
});

test('SemiphemeralAPIClient.getNewApiToken() returns true on valid device token', async () => {
    mockFetch.mockClear();

    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-device-token';

    const client = new SemiphemeralAPIClient();
    await client.initialize(mockAPIURL);
    client.setUserEmail(userEmail);
    client.setDeviceToken(deviceToken);

    mockFetch.mockResolvedValue(createFetchResponse(200, {
        api_token: 'this-is-a-new-api-token',
        email: userEmail
    }));

    const result = await client.getNewApiToken();
    expect(mockFetch).toHaveBeenCalledWith('https://mock/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: userEmail,
            device_token: deviceToken
        })
    });

    expect(result).toBe(true);
});

test('SemiphemeralAPIClient.getNewApiToken() returns false on invalid device token', async () => {
    mockFetch.mockClear();

    const userEmail = 'test@lockdown.systems';
    const deviceToken = 'this-is-a-BAD-device-token';

    const client = new SemiphemeralAPIClient();
    await client.initialize(mockAPIURL);
    client.setUserEmail(userEmail);
    client.setDeviceToken(deviceToken);

    mockFetch.mockResolvedValue(createFetchResponse(401, {
        message: 'Authentication failed'
    }))

    const result = await client.getNewApiToken();
    expect(mockFetch).toHaveBeenCalledWith('https://mock/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: userEmail,
            device_token: deviceToken
        })
    });

    expect(result).toBe(false);
});

