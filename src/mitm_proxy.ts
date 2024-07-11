import fs from 'fs'
import path from "path"

import { ipcMain, session } from 'electron'
import { Proxy } from "http-mitm-proxy"

import { findOpenPort, getAccountSettingsPath } from "./helpers"
import { Account } from './shared_types'
import { getAccount } from './database'

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

        // Set the proxy SSL dir
        const accountSettingsPath = getAccountSettingsPath(accountID);
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

    async startMITM(ses: Electron.Session) {
        // Start the proxy
        console.log(`MITMController: Account ${this.account?.id}, starting MITM`);
        this.proxyPort = await findOpenPort()
        this.proxy.listen({
            port: this.proxyPort,
            sslCaDir: this.proxySSLCADir,
        });

        console.log(`MITMController: Account ${this.account?.id}, listening on port ${this.proxyPort}`);

        // Make the webview use the proxy
        ses.setProxy({
            proxyRules: `127.0.0.1:${this.proxyPort}`
        })

        // Verify SSL certificates
        ses.setCertificateVerifyProc((request, callback) => {
            const certPath = path.join(this.proxySSLCADir, 'certs', `${request.hostname}.pem`);
            const certData = fs.readFileSync(certPath).toString();

            // Trim whitespace and remove the '\r' characters, to normalize the certificates
            const certDataTrimmed = certData.trim().replace(/\r/g, '');
            const requestDataTrimmed = request.certificate.data.trim().replace(/\r/g, '');

            if (certDataTrimmed == requestDataTrimmed) {
                // Certificate verified
                callback(0);
            } else {
                // Fallback to Chromium certificate verification
                callback(-3);
            }
        })
    }

    async stopMITM(ses: Electron.Session) {
        console.log(`MITMController: Account ${this.account?.id}, stopping MITM`);
        this.proxy.close();

        // Use the default proxy settings again
        ses.setProxy({})

        // Use Chromium for SSL verification
        ses.setCertificateVerifyProc((_request, callback) => {
            callback(-3);
        })
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