import fs from 'fs'
import path from "path"

import { ipcMain, session } from 'electron'
import { Proxy, IContext } from "http-mitm-proxy"

import { findOpenPort, getAccountSettingsPath } from "./helpers"
import { Account } from './shared_types'
import { getAccount } from './database'

class CustomProxy extends Proxy {
    _onError(kind: string, ctx: IContext | null, err: Error) {
        // Removed console.error lines
        this.onErrorHandlers.forEach((handler) => handler(ctx, err, kind));
        if (ctx) {
            ctx.onErrorHandlers.forEach((handler) => handler(ctx, err, kind));

            if (ctx.proxyToClientResponse && !ctx.proxyToClientResponse.headersSent) {
                ctx.proxyToClientResponse.writeHead(504, "Proxy Error");
            }
            if (ctx.proxyToClientResponse && !ctx.proxyToClientResponse.finished) {
                ctx.proxyToClientResponse.end(`${kind}: ${err}`, "utf8");
            }
        }
    }
}

type ResponseData = {
    host: string;
    url: string;
    body: string;
}

class MITMController {
    private account: Account | null;
    private proxy: Proxy | null;
    private proxyPort: number;
    private proxySSLCADir: string;
    private proxyFilter: string[];
    private isMonitoring: boolean;

    public responseData: ResponseData[];

    constructor(accountID: number) {
        this.proxyFilter = [];
        this.proxy = null;

        this.isMonitoring = false;
        this.responseData = [];

        // Load the account
        this.account = getAccount(accountID);
        if (!this.account) {
            console.error(`MITMController: account ${accountID} not found`);
            return;
        }

        // Set the proxy SSL dir
        const accountSettingsPath = getAccountSettingsPath(accountID);
        this.proxySSLCADir = path.join(accountSettingsPath, 'ca');
    }

    async startMITM(ses: Electron.Session, proxyFilter: string[]) {
        // Set the proxy filters
        this.proxyFilter = proxyFilter;

        // Create the proxy
        this.proxy = new CustomProxy();
        this.proxy.onError((_ctx, _err) => {
            // ignore errors
        });

        this.proxy.onRequest((ctx, callback) => {
            if (this.isMonitoring) {
                const url = `${ctx.clientToProxyRequest.headers.host}${ctx.clientToProxyRequest.url}`;
                for (const filter of this.proxyFilter) {
                    if (url.includes(filter)) {
                        // We're monitoring this request
                        console.log(`MITMController: Account ${this.account?.id} request filtered: ${url}`);

                        const responseData: ResponseData = {
                            host: ctx.clientToProxyRequest.headers.host ?? '',
                            url: ctx.clientToProxyRequest.url ?? '',
                            body: '',
                        }

                        ctx.onResponseData(function (ctx, chunk, callback) {
                            responseData.body += chunk.toString();
                            return callback(null, chunk);
                        });

                        ctx.onResponseEnd(function (ctx, callback) {
                            console.log(`MITMController: Account ${this.account?.id} response filtered: ${url}`, responseData);
                            this.responseData.push(responseData);
                            return callback();
                        });
                    }
                }
            }
            return callback();
        });

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
        if (this.proxy) {
            this.proxy.close();
            this.proxy = null;
        }
        this.proxyFilter = [];

        // Use the default proxy settings again
        ses.setProxy({})

        // Use Chromium for SSL verification
        ses.setCertificateVerifyProc((_request, callback) => {
            callback(-3);
        })
    }

    async startMonitoring() {
        this.responseData = [];
        this.isMonitoring = true;
    }

    async stopMonitoring() {
        this.isMonitoring = false;
    }
}

export const mitmControllers: Record<number, MITMController> = {};

export const defineIPCMITMProxy = () => {
    ipcMain.handle('mitmProxy:start', async (_, accountID: number, proxyFilter: string[]) => {
        // If no account info exists, create it
        if (!mitmControllers[accountID]) {
            mitmControllers[accountID] = new MITMController(accountID);
            // TODO: handle error if account not found
        }

        // Start MITM
        const ses = session.fromPartition(`persist:account-${accountID}`);
        await mitmControllers[accountID].startMITM(ses, proxyFilter);
    });

    ipcMain.handle('mitmProxy:stop', async (_, accountID: number) => {
        // Stop MITM
        const ses = session.fromPartition(`persist:account-${accountID}`);
        await mitmControllers[accountID].stopMITM(ses);
    });

    ipcMain.handle('mitmProxy:startMonitoring', async (_, accountID: number) => {
        // Start monitoring
        await mitmControllers[accountID].startMonitoring();
    });

    ipcMain.handle('mitmProxy:stopMonitoring', async (_, accountID: number) => {
        // Stop monitoring
        await mitmControllers[accountID].stopMonitoring();
    });
};
