import Database from 'better-sqlite3'
import { ipcMain } from 'electron';

import { exec, getMainDatabase } from './common';
import { packageExceptionForReport } from "../util"

// Types

interface ConfigRow {
    key: string;
    value: string;
}

// Functions

export const getConfig = (key: string, db: Database.Database | null = null): string | null => {
    if (!db) {
        db = getMainDatabase();
    }
    const row: ConfigRow | undefined = exec(db, 'SELECT value FROM config WHERE key = ?', [key], 'get') as ConfigRow | undefined;
    return row ? row.value : null;
}

export const setConfig = (key: string, value: string, db: Database.Database | null = null) => {
    if (!db) {
        db = getMainDatabase();
    }
    exec(db, 'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
}

// IPC

export const defineIPCDatabaseConfig = () => {
    ipcMain.handle('database:getConfig', async (_, key) => {
        try {
            return getConfig(key);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:setConfig', async (_, key, value) => {
        try {
            setConfig(key, value);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });
}