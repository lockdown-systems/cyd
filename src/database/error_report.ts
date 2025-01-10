import os from 'os';

import { app, ipcMain } from 'electron';

import { exec, getMainDatabase, Sqlite3Info } from './common';
import { ErrorReport } from '../shared_types'
import { packageExceptionForReport } from "../util"

// Types

export interface ErrorReportRow {
    id: number;
    createdAt: string;
    accountID: number;
    appVersion: string;
    clientPlatform: string;
    accountType: string;
    errorReportType: string;
    errorReportData: string;
    accountUsername: string;
    screenshotDataURI: string;
    sensitiveContextData: string;
    status: string; // "new", "submitted", and "dismissed"
}

// Functions

export const getErrorReport = (id: number): ErrorReport | null => {
    const row: ErrorReportRow | undefined = exec(getMainDatabase(), 'SELECT * FROM errorReport WHERE id = ?', [id], 'get') as ErrorReportRow | undefined;
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        createdAt: row.createdAt,
        accountID: row.accountID,
        appVersion: row.appVersion,
        clientPlatform: row.clientPlatform,
        accountType: row.accountType,
        errorReportType: row.errorReportType,
        errorReportData: row.errorReportData,
        accountUsername: row.accountUsername,
        screenshotDataURI: row.screenshotDataURI,
        sensitiveContextData: row.sensitiveContextData,
        status: row.status
    }
}

export const getNewErrorReports = (accountID: number): ErrorReport[] => {
    const rows: ErrorReportRow[] = exec(getMainDatabase(), 'SELECT * FROM errorReport WHERE accountID = ? AND status = ?', [accountID, 'new'], 'all') as ErrorReportRow[];
    const errorReports: ErrorReport[] = [];
    for (const row of rows) {
        errorReports.push({
            id: row.id,
            createdAt: row.createdAt,
            accountID: row.accountID,
            appVersion: row.appVersion,
            clientPlatform: row.clientPlatform,
            accountType: row.accountType,
            errorReportType: row.errorReportType,
            errorReportData: row.errorReportData,
            accountUsername: row.accountUsername,
            screenshotDataURI: row.screenshotDataURI,
            sensitiveContextData: row.sensitiveContextData,
            status: row.status
        });
    }
    return errorReports;
}

export const createErrorReport = (accountID: number, accountType: string, errorReportType: string, errorReportData: string, accountUsername: string | null, screenshotDataURI: string | null, sensitiveContextData: string | null) => {
    const info: Sqlite3Info = exec(getMainDatabase(), `
        INSERT INTO errorReport (
            accountID, 
            appVersion, 
            clientPlatform, 
            accountType, 
            errorReportType, 
            errorReportData, 
            accountUsername, 
            screenshotDataURI, 
            sensitiveContextData
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        accountID,
        app.getVersion(),
        os.platform(),
        accountType,
        errorReportType,
        errorReportData,
        accountUsername,
        screenshotDataURI,
        sensitiveContextData
    ]) as Sqlite3Info;
    const report = getErrorReport(info.lastInsertRowid);
    if (!report) {
        throw new Error("Failed to create error report");
    }
}

export const updateErrorReportSubmitted = (id: number) => {
    exec(getMainDatabase(), 'DELETE FROM errorReport WHERE id = ?', [id]);
}

export const dismissNewErrorReports = (accountID: number) => {
    exec(getMainDatabase(), 'DELETE FROM errorReport WHERE accountID = ? AND status = ?', [accountID, 'new']);
}

export const dismissAllNewErrorReports = () => {
    exec(getMainDatabase(), 'DELETE FROM errorReport WHERE status = ?', ['new']);
}

// IPC

export const defineIPCDatabaseErrorReport = () => {
    ipcMain.handle('database:getErrorReport', async (_, id): Promise<ErrorReport | null> => {
        try {
            return getErrorReport(id);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:getNewErrorReports', async (_, accountID: number): Promise<ErrorReport[]> => {
        try {
            return getNewErrorReports(accountID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:createErrorReport', async (_, accountID: number, accountType: string, errorReportType: string, errorReportData: string, accountUsername: string | null, screenshotDataURI: string | null, sensitiveContextData: string | null): Promise<void> => {
        try {
            createErrorReport(accountID, accountType, errorReportType, errorReportData, accountUsername, screenshotDataURI, sensitiveContextData);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:updateErrorReportSubmitted', async (_, id): Promise<void> => {
        try {
            updateErrorReportSubmitted(id);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:dismissNewErrorReports', async (_, accountID: number): Promise<void> => {
        try {
            dismissNewErrorReports(accountID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });
}