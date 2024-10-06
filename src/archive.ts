import fs from 'fs';
import path from 'path';

import { ipcMain, webContents } from 'electron';

import { packageExceptionForReport } from './util';

import mhtml2html from 'mhtml2html';
import { JSDOM } from 'jsdom';

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
            const html = mhtml2html.convert(mhtml, { parseDOM: (html) => new JSDOM(html) });

            // Save the HTML
            fs.writeFileSync(htmlFilename, html.serialize(), 'utf-8');

            // Delete the MHTML
            fs.unlinkSync(mhtmlFilename);

            return true;
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });
}
