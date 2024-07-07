import { ipcMain, session } from 'electron';

export const defineAccountXIPC = () => {
    ipcMain.handle('X:fetchStart', async (_, accountID: number) => {
        const ses = session.fromPartition(`persist:account-${accountID}`);
        ses.webRequest.onSendHeaders({ urls: ['https://x.com/i/api/graphql/*'], types: ['xhr'] }, async (details) => {
            if (details.url.includes("/UserTweetsAndReplies?")) {
                // Make a GlobalRequest from the details
                const req = new Request(details.url, {
                    method: details.method,
                    headers: details.requestHeaders,
                });
                const resp = await ses.fetch(req);
                console.log(`X:fetchStart: ${details.url} - ${resp.status}`);

                // try {
                //     const headers = new Headers();
                //     for (const header in details.requestHeaders) {
                //         headers.set(header, details.requestHeaders[header]);
                //     }

                //     const resp = await ses.fetch(details.url, { headers: headers });
                //     console.log(`X:fetchStart: ${details.url} - ${resp.status}`);
                // } catch (error) {
                //     console.error('Fetch error:', error);
                //     console.log(`X:fetchStart: ${details.url} - error`);
                // }
            }
        });
    });

    ipcMain.handle('X:fetchStop', async (_, accountID: number) => {
        const ses = session.fromPartition(`persist:account-${accountID}`);
        ses.webRequest.onSendHeaders({ urls: ['https://x.com/i/api/graphql/*'], types: ['xhr'] }, () => { });
    });
};