import { createServer } from 'net'
import path from "path"
import fs from 'fs'

import { app, ipcMain, session } from 'electron'
import { Proxy } from "http-mitm-proxy"

import { Account } from './shared_types'
import { getAccount } from './database'

async function findOpenPort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                return reject(new Error('No address'));
            }
            const port = address.port;
            server.close(() => {
                resolve(port);
            });
        });
    });
}

class MITMController {
    private account: Account | null;
    private proxy: Proxy;
    private proxyPort: number;
    private proxySSLCADir: string;

    constructor(accountID: number) {
        // Load the account
        this.account = getAccount(accountID);
        if (!this.account) {
            console.error(`MITMController: account ${accountID} not found`);
            return;
        }

        // Make sure the account settings folder exists
        const accountSettingsPath = `${path.join(app.getPath('userData'), `account-${accountID}`)}`;
        if (!fs.existsSync(accountSettingsPath)) {
            fs.mkdirSync(accountSettingsPath);
        }

        // Set the CA path
        this.proxySSLCADir = path.join(accountSettingsPath, 'ca');

        // Create the proxy
        this.proxy = new Proxy();
        this.proxy.onError(function (_ctx, err) {
            console.log(`MITMController: Account ${accountID}, request`, err);
        });

        this.proxy.onRequest(function (ctx, callback) {
            console.log(`MITMController: Account ${accountID}, request`, ctx.clientToProxyRequest.headers.host, ctx.clientToProxyRequest.url);
            return callback();
        });
    }

    async startMITM(_ses: Electron.Session) {
        console.log(`MITMController: Account ${this.account?.id}, starting MITM`);
        this.proxyPort = await findOpenPort()
        this.proxy.listen({
            port: this.proxyPort,
            sslCaDir: this.proxySSLCADir,
        });

        console.log(`MITMController: Account ${this.account?.id}, listening on port ${this.proxyPort}`);
        // ses.webRequest.onSendHeaders({ urls: ['https://x.com/i/api/graphql/*'], types: ['xhr'] }, () => { });
    }

    async stopMITM(_ses: Electron.Session) {
        console.log(`MITMController: Account ${this.account?.id}, stopping MITM`);
        this.proxy.close();

        // ses.webRequest.onSendHeaders({ urls: ['https://x.com/i/api/graphql/*'], types: ['xhr'] }, () => { });
    }
}

export const mitmControllers: Record<number, MITMController> = {};

export const defineIPCMITMProxy = () => {
    ipcMain.handle('mitmProxy:start', async (_, accountID: number) => {
        // If no account info exists, create it
        if (!mitmControllers[accountID]) {
            mitmControllers[accountID] = new MITMController(accountID);
            // TODO: handle error if account not found
        }

        // Start MITM
        const ses = session.fromPartition(`persist:account-${accountID}`);
        await mitmControllers[accountID].startMITM(ses);
    });

    ipcMain.handle('mitmProxy:stop', async (_, accountID: number) => {
        // Stop MITM
        const ses = session.fromPartition(`persist:account-${accountID}`);
        await mitmControllers[accountID].stopMITM(ses);
    });
};