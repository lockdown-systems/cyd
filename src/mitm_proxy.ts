import fs from 'fs'
import path from "path"

import { Proxy, IContext } from "http-mitm-proxy"
import * as zlib from "zlib"

import { findOpenPort, getAccountSettingsPath } from "./helpers"
import { ResponseData, Account } from './shared_types'
import { getAccount } from './database'

class CustomProxy extends Proxy {
    _onError(kind: string, ctx: IContext | null, err: Error) {
        // Stop logging all the errors to the console
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

// Interface for the MITM controller, so allow for mocking
export interface IMITMController {
    responseData: ResponseData[];

    startMITM(ses: Electron.Session, proxyFilter: string[]): Promise<void>;
    stopMITM(ses: Electron.Session): Promise<void>;
    startMonitoring(): Promise<void>;
    stopMonitoring(): Promise<void>;
}

export class MITMController implements IMITMController {
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
        this.proxy.onRequest((ctx, callback) => {
            if (this.isMonitoring) {
                const url = `${ctx.clientToProxyRequest.headers.host}${ctx.clientToProxyRequest.url}`;
                for (const filter of this.proxyFilter) {
                    if (url.includes(filter)) {
                        // We're monitoring this request
                        const responseData: ResponseData = {
                            host: ctx.clientToProxyRequest.headers.host ?? '',
                            url: ctx.clientToProxyRequest.url ?? '',
                            status: 0,
                            headers: {},
                            body: '',
                            processed: false,
                        }

                        const chunks: Buffer[] = [];

                        ctx.onResponseData((ctx, chunk, callback) => {
                            // console.log(`MITMController: response chunk (${chunk.length} bytes)`);
                            chunks.push(chunk);
                            return callback(null, chunk);
                        });

                        ctx.onResponseEnd((ctx, callback) => {
                            responseData.status = ctx.serverToProxyResponse?.statusCode ?? 0;
                            responseData.headers = ctx.serverToProxyResponse?.headers ?? {};

                            const buffer = Buffer.concat(chunks);

                            if (ctx.serverToProxyResponse?.headers['content-encoding'] === 'gzip') {
                                // Response is gzip-compressed
                                // console.log(`MITMController: response is gzip-compressed`);
                                zlib.gunzip(buffer, (err, decompressed) => {
                                    if (!err) {
                                        responseData.body = decompressed.toString();
                                    } else {
                                        console.error("Error decompressing gzip response:", err);
                                        responseData.body = buffer.toString();
                                    }

                                    console.log(`MITMController: got response`, {
                                        host: ctx.clientToProxyRequest.headers.host,
                                        url: ctx.clientToProxyRequest.url,
                                        status: responseData.status,
                                        bodyLength: responseData.body.length,
                                    });
                                    this.responseData.push(responseData);
                                    return callback();
                                });
                            } else if (ctx.serverToProxyResponse?.headers['content-encoding'] === 'br') {
                                // Response is brotli-compressed
                                // console.log(`MITMController: response is brotli-compressed`);
                                zlib.brotliDecompress(buffer, (err, decompressed) => {
                                    if (!err) {
                                        responseData.body = decompressed.toString();
                                    } else {
                                        console.error("Error decompressing brotli response:", err);
                                        responseData.body = buffer.toString();
                                    }

                                    console.log(`MITMController: got response`, {
                                        host: ctx.clientToProxyRequest.headers.host,
                                        url: ctx.clientToProxyRequest.url,
                                        status: responseData.status,
                                        bodyLength: responseData.body.length,
                                    });
                                    this.responseData.push(responseData);
                                    return callback();
                                });
                            } else if (ctx.serverToProxyResponse?.headers['content-encoding'] === 'deflate') {
                                // Response is deflate-compressed
                                // console.log(`MITMController: response is deflate-compressed`);
                                zlib.inflate(buffer, (err, decompressed) => {
                                    if (!err) {
                                        responseData.body = decompressed.toString();
                                    } else {
                                        console.error("Error decompressing deflate response:", err);
                                        responseData.body = buffer.toString();
                                    }

                                    console.log(`MITMController: got response`, {
                                        host: ctx.clientToProxyRequest.headers.host,
                                        url: ctx.clientToProxyRequest.url,
                                        status: responseData.status,
                                        bodyLength: responseData.body.length,
                                    });
                                    this.responseData.push(responseData);
                                    return callback();
                                });
                            } else {
                                // If not compressed, just convert buffer to string
                                // console.log(`MITMController: response is not compressed`);
                                responseData.body = buffer.toString();

                                console.log(`MITMController: got response`, {
                                    host: ctx.clientToProxyRequest.headers.host,
                                    url: ctx.clientToProxyRequest.url,
                                    status: responseData.status,
                                    bodyLength: responseData.body.length,
                                });
                                this.responseData.push(responseData);
                                return callback();
                            }
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
            host: "127.0.0.1",
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

const mitmControllers: Record<number, MITMController> = {};

export const getMITMController = (accountID: number): MITMController => {
    if (!mitmControllers[accountID]) {
        mitmControllers[accountID] = new MITMController(accountID);
    }
    return mitmControllers[accountID];
}
