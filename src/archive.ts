import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

import { ipcMain, session } from 'electron';
import extract from 'extract-zip';
import Database from 'better-sqlite3'

import { getAccountTempPath, getResourcesPath, getChromiumAppPath, getChromiumBinPath, getSinglefileBinPath } from './helpers';

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
        return fs.existsSync(binPath);
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

        if (!fs.existsSync(zipPath)) {
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
        const cookiesPath = path.join(getAccountTempPath(accountID), 'cookies.json');
        fs.writeFileSync(cookiesPath, cookiesJSON);
    });

    ipcMain.handle('archive:deleteCookiesFile', async (_, accountID: number) => {
        const cookiesPath = path.join(getAccountTempPath(accountID), 'cookies.json');
        fs.unlinkSync(cookiesPath);
    });

    ipcMain.handle('archive:singleFile', async (_, accountID: number, outputPath: string, urls: string[], retry: boolean): Promise<boolean> => {
        // Figure out the paths
        const chromiumBinPath = getChromiumBinPath();
        const singlefileBinPath = getSinglefileBinPath();
        if (!chromiumBinPath || !singlefileBinPath) {
            return false;
        }

        // Find the IDs that are already saved
        let filenames: string[] = [];
        try {
            filenames = fs.readdirSync(outputPath);
        } catch (error) {
            return false;
        }
        const savedIDs: string[] = [];
        for (const filename of filenames) {
            const id = filename.split('.')[0];
            savedIDs.push(id);
        }

        let urlsToSave: string[] = [];
        if (retry) {
            urlsToSave = urls;
        } else {
            // Remove URLs that are already saved
            urlsToSave = urls.filter(url => {
                const urlLastSegment = url.split('/').pop();
                if (!urlLastSegment) {
                    return false;
                }
                return !savedIDs.includes(urlLastSegment);
            });

            // Return early if all of these posts are already saved
            if (urlsToSave.length == 0) {
                return true;
            }
        }

        // Save the URLs to disk
        const urlsPath = path.join(getAccountTempPath(accountID), "urls.txt");
        fs.writeFileSync(urlsPath, urlsToSave.join('\n'), 'utf-8');


        // Try a few times
        let tries = 0;
        while (tries < 3) {
            const cookiesPath = path.join(getAccountTempPath(accountID), 'cookies.json');
            const args = [
                '--browser-executable-path', chromiumBinPath,
                '--browser-load-max-time', '30000',
                '--browser-cookies-file', cookiesPath,
                '--browser-wait-delay', '1000', // wait an extra second
                '--compress-CSS', 'true',
                '--compress-HTML', 'true',
                '--output-directory', outputPath,
                '--urls-file', urlsPath,
                // URLs are like: https://x.com/{username}/status/{tweetID}
                // So filenames will be like: {tweetID}.html
                '--filename-template', '{url-last-segment}.{filename-extension}',
                // Overwrite if the file already exists
                '--filename-conflict-action', 'overwrite'
            ]
            console.log(`Running SingleFile (try #${tries}): ${singlefileBinPath} ${args.join(' ')}`);

            const savePages = () => new Promise<void>((resolve, reject) => {
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

                child.on('error', (error) => {
                    console.error(`Failed to start child process: ${error.message}`);
                    reject(error);
                });
            });

            try {
                await savePages();
                console.log('SingleFile completed');
                return true;
            } catch (error) {
                console.error(`Failed to save page: ${error.message}`);
                tries += 1;
            }
        }
        return false;
    });
}
