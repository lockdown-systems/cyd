import fs from 'fs'
import path from "path"

import { Proxy, IContext } from "http-mitm-proxy"

import * as zlib from "zlib"
import * as zstd from "@mongodb-js/zstd"

import log from 'electron-log/main';

import { findOpenPort, getAccountSettingsPath } from "./util"
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
    clearProcessed(): Promise<void>;
}

export class MITMController implements IMITMController {
    private account: Account | null;
    private proxy: CustomProxy | null;
    private proxyPort: number;
    private proxySSLCADir: string;
    private proxyFilter: string[];
    private isMonitoring: boolean;

    public responseData: ResponseData[];

    constructor(accountID: number) {
        this.proxyFilter = [];
        this.proxy = null;

        this.proxyPort = 0;
        this.proxySSLCADir = '';

        this.isMonitoring = false;
        this.responseData = [];

        // Load the account
        this.account = getAccount(accountID);
        if (!this.account) {
            log.error(`MITMController: account ${accountID} not found`);
            return;
        }

        // Set the proxy SSL dir
        const accountSettingsPath = getAccountSettingsPath(accountID);
        this.proxySSLCADir = path.join(accountSettingsPath, 'ca');
    }

    async startMITM(ses: Electron.Session, proxyFilter: string[]) {
        log.info(`MITMController: Account ${this.account?.id}, starting proxy`, proxyFilter);

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
                            chunks.push(chunk);
                            return callback(null, chunk);
                        });

                        ctx.onResponseEnd((ctx, callback) => {
                            responseData.status = ctx.serverToProxyResponse?.statusCode ?? 0;
                            responseData.headers = ctx.serverToProxyResponse?.headers ?? {};

                            const buffer = Buffer.concat(chunks);

                            if (ctx.serverToProxyResponse?.headers['content-encoding'] === 'gzip') {
                                // Response is gzip-compressed
                                zlib.gunzip(buffer, (err, decompressed) => {
                                    if (!err) {
                                        responseData.body = decompressed.toString();
                                    } else {
                                        log.error("Error decompressing gzip response:", err);
                                        responseData.body = buffer.toString();
                                    }

                                    log.debug(`MITMController: got response`, {
                                        host: ctx.clientToProxyRequest.headers.host,
                                        url: ctx.clientToProxyRequest.url,
                                        status: responseData.status,
                                        bodyLength: responseData.body.length,
                                    });
                                    this.responseData.push(responseData);
                                    return callback();
                                });
                            } else if (ctx.serverToProxyResponse?.headers['content-encoding'] === 'zstd') {
                                // Response is zstd-compressed
                                zstd.decompress(buffer).then(decompressed => {
                                    responseData.body = decompressed.toString();

                                    log.debug(`MITMController: got response`, {
                                        host: ctx.clientToProxyRequest.headers.host,
                                        url: ctx.clientToProxyRequest.url,
                                        status: responseData.status,
                                        bodyLength: responseData.body.length,
                                    });
                                    this.responseData.push(responseData);
                                    return callback();
                                }).catch(err => {
                                    log.error("Error decompressing zstd response:", err);
                                    responseData.body = buffer.toString();

                                    log.debug(`MITMController: got response`, {
                                        host: ctx.clientToProxyRequest.headers.host,
                                        url: ctx.clientToProxyRequest.url,
                                        status: responseData.status,
                                        bodyLength: responseData.body.length,
                                    });
                                    this.responseData.push(responseData);
                                    return callback();
                                });
                            }
                            else if (ctx.serverToProxyResponse?.headers['content-encoding'] === 'br') {
                                // Response is brotli-compressed
                                zlib.brotliDecompress(buffer, (err, decompressed) => {
                                    if (!err) {
                                        responseData.body = decompressed.toString();
                                    } else {
                                        log.error("Error decompressing brotli response:", err);
                                        responseData.body = buffer.toString();
                                    }

                                    log.debug(`MITMController: got response`, {
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
                                zlib.inflate(buffer, (err, decompressed) => {
                                    if (!err) {
                                        responseData.body = decompressed.toString();
                                    } else {
                                        log.error("Error decompressing deflate response:", err);
                                        responseData.body = buffer.toString();
                                    }

                                    log.debug(`MITMController: got response`, {
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
                                responseData.body = buffer.toString();

                                log.debug(`MITMController: got response`, {
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

        // Delete the old certificates
        const certsPath = path.join(this.proxySSLCADir, 'certs');
        if (fs.existsSync(certsPath)) {
            log.debug(`Deleting old certificates dir: ${certsPath}`);
            fs.rmSync(certsPath, { recursive: true });
        } else {
            log.debug(`Certificates dir: ${certsPath}`);
        }

        // Verify SSL certificates
        ses.setCertificateVerifyProc((request, callback) => {
            const certPath = path.join(this.proxySSLCADir, 'certs', `${request.hostname}.pem`);
            let certData: string;
            try {
                certData = fs.readFileSync(certPath).toString();
            } catch (e) {
                log.error(`MITMController: Account ${this.account?.id}, error reading certificate:`, e);
                // TODO: mark as verified for now
                callback(0);
                return;
            }

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

        // Start the proxy
        this.proxyPort = await findOpenPort()
        this.proxy.listen({
            host: "127.0.0.1",
            port: this.proxyPort,
            sslCaDir: this.proxySSLCADir,
        });
        log.info(`MITMController: Account ${this.account?.id}, proxy listening on port ${this.proxyPort}`);

        // Make the webview use the proxy
        ses.setProxy({
            proxyRules: `127.0.0.1:${this.proxyPort}`
        })

        // Wait for proxy to be ready
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    async stopMITM(ses: Electron.Session) {
        log.info(`MITMController: Account ${this.account?.id}, stopping proxy`);
        if (this.proxy) {
            log.debug("Stopping proxy")
            try {
                this.proxy.close();
            } catch (e) {
                log.error("Error stopping proxy:", e);
            }
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

    async clearProcessed() {
        this.responseData = this.responseData.filter((data) => !data.processed);
    }
}

const mitmControllers: Record<number, MITMController> = {};

export const getMITMController = (accountID: number): MITMController => {
    if (!mitmControllers[accountID]) {
        mitmControllers[accountID] = new MITMController(accountID);
    }
    return mitmControllers[accountID];
}
