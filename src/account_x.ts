import { ipcMain, session } from 'electron';

export const defineAccountXIPC = () => {
    ipcMain.handle('X:fetchStart', async (_, accountID: number) => {
        const ses = session.fromPartition(`persist:account-${accountID}`);
        ses.webRequest.onCompleted({ urls: ['https://x.com/i/api/graphql/*'], types: ['xhr'] }, (details) => {
            if (details.statusCode === 200 && details.webContents) {
                console.log(details.url);
            }
        });
    });

    ipcMain.handle('X:fetchStop', async (_, accountID: number) => {
        const ses = session.fromPartition(`persist:account-${accountID}`);
        ses.webRequest.onCompleted({ urls: ['https://x.com/i/api/graphql/*'], types: ['xhr'] }, () => { });
    });
};