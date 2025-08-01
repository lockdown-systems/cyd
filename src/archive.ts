import fs from 'fs';
import path from 'path';

import { ipcMain, webContents, shell } from 'electron';
import log from 'electron-log/main';

import { packageExceptionForReport, getAccountDataPath, getDataPath } from './util';
import { Account, ArchiveInfo, emptyArchiveInfo } from './shared_types';
import { getAccount } from './database'

import mhtml2html from 'mhtml2html';
import { JSDOM } from 'jsdom';

const getArchivePath = (account: Account): string | null => {
    if (account.type == "X" && account.xAccount && account.xAccount.username) {
        return getAccountDataPath("X", account.xAccount.username);
    } else if (account.type == "Facebook" && account.facebookAccount && account.facebookAccount.accountID && account.facebookAccount.name) {
        const facebookDataPath = path.join(getDataPath(), "Facebook");

        // See if there is a folder in this path that starts with account.facebookAccount.accountID
        // This way if the user changes their name, we can still find the folder
        const facebookAccountFolders = fs.readdirSync(facebookDataPath);
        for (const folder of facebookAccountFolders) {
            if (folder.startsWith(account.facebookAccount.accountID)) {
                return path.join(facebookDataPath, folder);
            }
        }

        // Otherwise, fallback to the accountID and name
        return getAccountDataPath("Facebook", `${account.facebookAccount.accountID} ${account.facebookAccount.name}`);
    }
    return null;
}

export const defineIPCArchive = () => {
    ipcMain.handle('archive:isPageAlreadySaved', async (_, outputPath: string, basename: string): Promise<boolean> => {
        try {
            const htmlFilename = path.join(outputPath, `${basename}.html`);
            return fs.existsSync(htmlFilename);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('archive:savePage', async (_, webContentsID: number, outputPath: string, basename: string): Promise<boolean> => {
        try {
            const wc = webContents.fromId(webContentsID);
            if (!wc) {
                return false;
            }

            const mhtmlFilename = path.join(outputPath, `${basename}.mhtml`);
            const htmlFilename = path.join(outputPath, `${basename}.html`);

            // Save as MHTML
            await wc.savePage(mhtmlFilename, 'MHTML');

            // Convert to HTML
            const mhtml = fs.readFileSync(mhtmlFilename, 'utf-8');
            const html = mhtml2html.convert(mhtml, {
                parseDOM: (html: string) => new JSDOM(html)
            });

            // Save the HTML
            fs.writeFileSync(htmlFilename, html.serialize(), 'utf-8');

            // Delete the MHTML
            fs.unlinkSync(mhtmlFilename);

            return true;
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('archive:openFolder', async (_, accountID: number, folderName: string): Promise<void> => {
        const account = getAccount(accountID);
        if (!account) {
            log.warn('archive:openFolder', `Account not found: ${accountID}`);
            return;
        }

        const archivePath = getArchivePath(account);
        if (!archivePath) {
            log.warn('archive:openFolder', `error getting archive path`);
            return;
        }

        const folderPath = path.join(archivePath, folderName);
        await shell.openPath(folderPath);
    });

    ipcMain.handle('archive:getInfo', async (_, accountID: number): Promise<ArchiveInfo> => {
        const archiveInfo = emptyArchiveInfo();

        const account = getAccount(accountID);
        if (!account) {
            log.warn('archive:getInfo', `Account not found: ${accountID}`);
            return archiveInfo;
        }

        const archivePath = getArchivePath(account);
        if (!archivePath) {
            log.debug('archive:getInfo', `failed to get archive path`);
            return archiveInfo;
        }

        const indexHTMLFilename = path.join(archivePath, "index.html");

        archiveInfo.folderEmpty = !fs.existsSync(archivePath) || fs.readdirSync(archivePath).length === 0;
        archiveInfo.indexHTMLExists = fs.existsSync(indexHTMLFilename);
        return archiveInfo;
    });
}
