import os from 'os';
import path from 'path';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';

import { ipcMain, session } from 'electron';
import extract from 'extract-zip';

import { getAccountDataPath, getAccountSettingsPath, getResourcesPath, getChromiumAppPath, getChromiumBinPath, getSinglefileBinPath } from './helpers';
import { getAccount, getAccountUsername } from './database';

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

    // Returns the path to the saved HTML file
    ipcMain.handle('archive:savePage', async (_, accountID: number, url: string, postDate: Date, postID: string): Promise<string | null> => {
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

        // Get the session cookies
        const ses = session.fromPartition(`persist:account-${accountID}`);
        const cookies = ses.cookies.get({});
        const cookiesJSON = JSON.stringify(cookies);
        const cookiesPath = path.join(getAccountSettingsPath(accountID), 'cookies.json');
        writeFileSync(cookiesPath, cookiesJSON);

        // Build the output filename
        const accountDataPath = getAccountDataPath(account.type, accountUsername);
        const filename = `${postDate.toISOString().replace(/:/g, '-')}-${postID}.html`;
        const outputFolder = path.join(accountDataPath, 'Archived Tweets');
        if (!existsSync(outputFolder)) {
            mkdirSync(outputFolder);
        }
        const outputPath = path.join(outputFolder, filename);

        // Fire!
        const args = [
            '--browser-executable-path', chromiumBinPath,
            '--browser-load-max-time', '30000',
            '--browser-cookies-file', cookiesPath,
            '--compress-CSS', 'true',
            '--compress-HTML', 'true',
            url, outputPath
        ]
        console.log(`Running SingleFile: ${singlefileBinPath} ${args.join(' ')}`);
        const child = spawn(singlefileBinPath, args);

        child.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        child.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        child.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });

        // Delete the cookies file
        // unlinkSync(cookiesPath);

        // Check if the file was created
        if (!existsSync(outputPath)) {
            console.error(`Failed to save page: ${outputPath}`);
            return null;
        }
        console.log(`Saved page: ${outputPath}`);

        return outputPath;
    });
};
