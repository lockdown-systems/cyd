import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

import { ipcMain, session, Extension, BrowserWindow } from 'electron';
import extract from 'extract-zip';
import Database from 'better-sqlite3'

import { getAccountTempPath, getResourcesPath, getChromiumAppPath, getChromiumBinPath, getSinglefileBinPath, getVendorPath } from './helpers';

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

// const SINGLEFILE_FILENAME = 'SingleFile-MV3-main.zip';
// const SINGLEFILE_PATH = 'SingleFile-MV3-main';
const SINGLEFILE_FILENAME = 'SingleFile-1.2.0.zip';
const SINGLEFILE_PATH = 'SingleFile-1.2.0';

const singleFileExtensions: Record<number, Extension> = {};

const getSingleFileExtension = (accountID: number): Extension => {
    return singleFileExtensions[accountID];
}

export const defineIPCArchive = () => {
    ipcMain.handle('archive:isSingleFileExtracted', async (_): Promise<boolean> => {
        const vendorPath = getVendorPath();
        const singleFileExtensionPath = path.join(vendorPath, SINGLEFILE_PATH);
        return fs.existsSync(singleFileExtensionPath);
    });

    ipcMain.handle('archive:extractSingleFile', async (_): Promise<boolean> => {
        const vendorPath = getVendorPath();
        const resourcesPath = getResourcesPath();
        const zipPath = path.join(resourcesPath, SINGLEFILE_FILENAME);

        if (!fs.existsSync(zipPath)) {
            console.error(`SingleFile zip not found: ${zipPath}`);
            return false;
        }

        try {
            await extract(zipPath, { dir: vendorPath });
            return true;
        } catch (err) {
            console.error('Failed to extract SingleFile:', err);
            return false;
        }
    });

    ipcMain.handle('archive:isSingleFileExtensionInstalled', async (_, accountID: number): Promise<boolean> => {
        const ses = session.fromPartition(`persist:account-${accountID}`);
        const extensions = await ses.getAllExtensions();
        for (const extension of extensions) {
            if (extension.name === 'SingleFile') {
                return true;
            }
        }
        return false;
    });

    ipcMain.handle('archive:installSingleFileExtension', async (_, accountID: number): Promise<boolean> => {
        const ses = session.fromPartition(`persist:account-${accountID}`);
        try {
            const extension = await ses.loadExtension(path.join(getVendorPath(), 'SingleFile-1.2.0'), { allowFileAccess: true });
            console.log('archive:installSingleFileExtension: installed extension', extension.name);
            singleFileExtensions[accountID] = extension;
        } catch (err) {
            console.error('Failed to install SingleFile extension:', err);
            return false;
        }

        return true;
    });

    ipcMain.handle('archive:singleFileSavePage', async (_, accountID: number): Promise<boolean> => {
        const ses = session.fromPartition(`persist:account-${accountID}`);
        const extension = getSingleFileExtension(accountID);
        const backgroundPageUrl = `chrome-extension://${extension.id}/${extension.manifest.background.page}`;

        // Create a hidden BrowserWindow with the specified session
        const backgroundWindow = new BrowserWindow({
            show: true,
            webPreferences: {
                session: ses,
                nodeIntegration: false,
                contextIsolation: false,
                sandbox: false,
            },
        });
        backgroundWindow.webContents.openDevTools();

        // Load the background page URL
        console.log('Loading background page:', backgroundPageUrl);
        await backgroundWindow.loadURL(backgroundPageUrl);

        console.log('Background page loaded');

        // Execute JavaScript in the background page context
        const result = await backgroundWindow.webContents.executeJavaScript(`
        (() => {
            console.log('about to send a message');
            chrome.runtime.sendMessage('downloads.download', response => {
                console.log('response from extension:', response);
            });
            return chrome.runtime.getURL('test.html');
        })()
        `);

        console.log('Result from background page:', result);

        // Wait 10 seconds
        await new Promise(resolve => setTimeout(resolve, 60000));

        // Clean up the background window
        backgroundWindow.close();

        return true;
    });


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
                '--urls-file', urlsPath,
                // URLs are like: https://x.com/{username}/status/{tweetID}
                // So filenames will be like: {tweetID}.html
                '--filename-template', '{url-last-segment}.{filename-extension}',
                // Overwrite if the file already exists
                '--filename-conflict-action', 'overwrite',
            ]
            const quotedArgs = args.map(arg => (arg.includes(' ') ? `"${arg}"` : arg));
            console.log(`Running SingleFile (try #${tries}): ${singlefileBinPath} ${quotedArgs.join(' ')}`);

            const savePages = () => new Promise<void>((resolve, reject) => {
                const child = spawn(singlefileBinPath, args, {
                    // Set the working directory to outputPath instead of using --output-directory, since that doesn't seem to work
                    cwd: outputPath,
                });

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
