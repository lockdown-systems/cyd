import type { SQLiteDatabase } from "expo-sqlite";

export interface MockDatabase {
  execSync: jest.Mock;
  getAllSync: jest.Mock;
  getFirstSync: jest.Mock;
  runSync: jest.Mock;
  closeSync: jest.Mock;
  withTransactionSync: jest.Mock;
}

export function createMockDatabase(
  overrides?: Partial<MockDatabase>,
): SQLiteDatabase {
  const mockDb: MockDatabase = {
    execSync: jest.fn(),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
    closeSync: jest.fn(),
    withTransactionSync: jest.fn((callback) => callback()),
    ...overrides,
  };

  return mockDb as unknown as SQLiteDatabase;
}

export function createMockDatabaseWithData<T>(data: T[]): SQLiteDatabase {
  return createMockDatabase({
    getAllSync: jest.fn(() => data),
    getFirstSync: jest.fn(() => (data.length > 0 ? data[0] : null)),
    runSync: jest.fn(() => ({ changes: data.length, lastInsertRowId: 1 })),
  });
}
