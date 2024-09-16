import fs from 'fs';
import path from 'path';

import { beforeEach, afterEach, test, expect, vi } from 'vitest';

// Mock the helpers module
vi.mock('./util', () => ({
    ...vi.importActual('./util'), // Import and spread the actual implementations
    getSettingsPath: vi.fn(() => {
        const settingsPath = path.join(__dirname, '..', 'testdata', 'settingsPath');
        if (!fs.existsSync(settingsPath)) {
            fs.mkdirSync(settingsPath, { recursive: true });
        }
        return settingsPath
    }),
}));
import { getSettingsPath } from './util';

// Import the local modules after stuff has been mocked
// import { Account, XAccount } from './shared_types'
import * as database from './database';

beforeEach(() => {
    database.runMainMigrations();
});

afterEach(() => {
    fs.readdirSync(getSettingsPath()).forEach(file => {
        fs.unlinkSync(path.join(getSettingsPath(), file));
    });
});

// database tests

test("config, account, and xAccount tables should be created", async () => {
    const db = database.getMainDatabase();
    const tables = await database.exec(
        db,
        "SELECT name FROM sqlite_master WHERE type='table';",
        [],
        "all"
    );
    expect(tables).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'config' }),
        expect.objectContaining({ name: 'account' }),
        expect.objectContaining({ name: 'xAccount' }),
    ]));
})
