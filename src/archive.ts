import os from 'os';
import path from 'path';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';

import { ipcMain, session } from 'electron';
import extract from 'extract-zip';
import Database from 'better-sqlite3'

import { getAccountDataPath, getAccountSettingsPath, getResourcesPath, getChromiumAppPath, getChromiumBinPath, getSinglefileBinPath } from './helpers';
import { getAccount, getAccountUsername } from './database';

interface ChromiumCookie {
    creation_utc: number;
    host_key: string;
    top_frame_site_key: string | null;
    name: string;
    value: string;
    encrypted_value: string | null;
    path: string;
    expires_utc: number;
    is_secure: number;
    is_httponly: number;
    last_access_utc: number;
    has_expires: number;
    is_persistent: number;
    priority: number;
    samesite: number;
    source_scheme: number;
    source_port: number;
    last_update_utc: number;
    source_type: number;
    has_cross_site_ancestor: number;
}

export const defineIPCArchive = () => {
    ipcMain.handle('archive:isChromiumExtracted', async (_): Promise<boolean> => {
        const binPath = getChromiumBinPath();
        if (!binPath) {
            return false;
        }
        return existsSync(binPath);
    });

    ipcMain.handle('archive:extractChromium', async (_): Promise<boolean> => {
        const platform = os.platform();
        const arch = os.arch();
        const chromiumAppPath = getChromiumAppPath();
        const resourcesPath = getResourcesPath();

        let zipPath;
        switch (platform) {
            case 'darwin':
                if (arch == 'arm64') {
                    zipPath = path.join(resourcesPath, 'chromium-mac-arm64.zip');
                } else {
                    zipPath = path.join(resourcesPath, 'chromium-mac-intel.zip');
                }
                break;
            case 'win32':
                zipPath = path.join(resourcesPath, 'chromium-win-x64.zip');
                break;
            case 'linux':
                zipPath = path.join(resourcesPath, 'chromium-linux-x64.zip');
                break;
            default:
                return false;
        }

        if (!existsSync(zipPath)) {
            console.error(`Chromium zip not found: ${zipPath}`);
            return false;
        }

        try {
            await extract(zipPath, { dir: chromiumAppPath });
            return true;
        } catch (err) {
            console.error('Failed to extract Chromium:', err);
            return false;
        }
    });

    ipcMain.handle('archive:saveCookiesFile', async (_, accountID: number) => {
        const ses = session.fromPartition(`persist:account-${accountID}`);

        // For some reason this is returning an empty object, so we'll read the cookies from sqlite3 instead
        // const cookies = ses.cookies.get({});

        let chromiumCookies: ChromiumCookie[] = [];
        if (ses.storagePath) {
            const cookiesDatabasePath = path.join(ses.storagePath, 'Cookies');
            const db = new Database(cookiesDatabasePath, {});
            db.pragma('journal_mode = WAL');

            chromiumCookies = db.prepare('SELECT * FROM cookies').all() as ChromiumCookie[];
        }

        const cookies = chromiumCookies.map(cookie => {
            return {
                domain: cookie.host_key,
                expires: cookie.has_expires ? cookie.expires_utc : -1,
                httpOnly: cookie.is_httponly === 1,
                name: cookie.name,
                value: cookie.value,
                path: cookie.path,
                secure: cookie.is_secure === 1,
                session: cookie.is_persistent === 0,
                size: Buffer.byteLength(cookie.value, 'utf8')
            }
        });
        const cookiesJSON = JSON.stringify(cookies);
        const cookiesPath = path.join(getAccountSettingsPath(accountID), 'cookies.json');
        writeFileSync(cookiesPath, cookiesJSON);
    });

    ipcMain.handle('archive:deleteCookiesFile', async (_, accountID: number) => {
        const cookiesPath = path.join(getAccountSettingsPath(accountID), 'cookies.json');
        unlinkSync(cookiesPath);
    });

    // Returns the path to the saved HTML file
    ipcMain.handle('archive:savePage', async (_, accountID: number, url: string, postDate: Date, postID: string, outputFolderName: string): Promise<string | null> => {
        // Make sure we have the account and username
        const account = await getAccount(accountID);
        if (!account) {
            return null;
        }
        const accountUsername = await getAccountUsername(account);
        if (!accountUsername) {
            return null;
        }

        // Get the Chromium and SingleFile paths
        const chromiumBinPath = getChromiumBinPath();
        const singlefileBinPath = getSinglefileBinPath();
        if (!chromiumBinPath || !singlefileBinPath) {
            return null;
        }

        // Build the output filename
        const accountDataPath = getAccountDataPath(account.type, accountUsername);
        const filename = `${postDate.toISOString().split('T')[0]}_${postID}.html`;
        const outputFolder = path.join(accountDataPath, outputFolderName);
        if (!existsSync(outputFolder)) {
            mkdirSync(outputFolder);
        }
        const outputPath = path.join(outputFolder, filename);

        // Check if the file already exists
        if (existsSync(outputPath)) {
            console.log(`Page already saved: ${outputPath}`);
            return outputPath;
        }

        // Fire!
        const cookiesPath = path.join(getAccountSettingsPath(accountID), 'cookies.json');
        const args = [
            '--browser-executable-path', chromiumBinPath,
            '--browser-load-max-time', '30000',
            '--browser-cookies-file', cookiesPath,
            '--compress-CSS', 'true',
            '--compress-HTML', 'true',
            url, outputPath
        ]
        console.log(`Running SingleFile: ${singlefileBinPath} ${args.join(' ')}`);

        const savePage = () => new Promise<void>((resolve, reject) => {
            const child = spawn(singlefileBinPath, args);

            child.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });

            child.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
            });

            child.on('close', (code) => {
                console.log(`child process exited with code ${code}`);
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Child process exited with code ${code}`));
                }
            });
        });

        try {
            await savePage();
        } catch (error) {
            console.error(`Failed to save page: ${error.message}`);
            return null;
        }

        // Check if the file was created
        if (!existsSync(outputPath)) {
            console.error(`Failed to save page: ${outputPath}`);
            return null;
        }
        console.log(`Saved page: ${outputPath}`);

        return outputPath;
    });
};
