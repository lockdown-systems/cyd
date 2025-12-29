// Mock controller interfaces for testing
// Note: BaseAccountController will be created in Phase 1

export interface MockAccountController {
  start: jest.Mock;
  stop: jest.Mock;
  pause: jest.Mock;
  resume: jest.Mock;
  deleteAllData: jest.Mock;
}

export function createMockController(
  overrides?: Partial<MockAccountController>,
): MockAccountController {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    deleteAllData: jest.fn(),
    ...overrides,
  };
}

export interface MockOAuthClient {
  authorize: jest.Mock;
  restore: jest.Mock;
  revoke: jest.Mock;
  callback: jest.Mock;
}

export function createMockOAuthClient(
  overrides?: Partial<MockOAuthClient>,
): MockOAuthClient {
  return {
    authorize: jest.fn(() =>
      Promise.resolve({ session: { did: "did:test:123" } }),
    ),
    restore: jest.fn(() => Promise.resolve({ did: "did:test:123" })),
    revoke: jest.fn(() => Promise.resolve()),
    callback: jest.fn(() =>
      Promise.resolve({ session: { did: "did:test:123" } }),
    ),
    ...overrides,
  };
}
