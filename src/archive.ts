import fs from 'fs';

import { ipcMain, webContents } from 'electron';
import mhtml2html from 'mhtml2html';
import { JSDOM } from 'jsdom';

export const defineIPCArchive = () => {
    ipcMain.handle('archive:savePage', async (_, webContentsID: number): Promise<boolean> => {
        const wc = webContents.fromId(webContentsID);
        if (!wc) {
            return false;
        }

        await wc.savePage('/home/user/tmp/savepage/test.mhtml', 'MHTML');

        // Load test.mhtml as a string
        const mhtmlPath = '/home/user/tmp/savepage/test.mhtml';
        const mhtml = fs.readFileSync(mhtmlPath, 'utf-8');
        const htmlDoc = mhtml2html.convert(mhtml, { parseDOM: (html) => new JSDOM(html) });

        // Save the HTML to a file
        const htmlPath = '/home/user/tmp/savepage/test.html';
        fs.writeFileSync(htmlPath, htmlDoc.serialize(), 'utf-8');

        return true;
    });
}
