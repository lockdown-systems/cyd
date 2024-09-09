import { WebviewTag } from 'electron';
import type { Account } from '../../../shared_types';
import { SemiphemeralAPIClient } from 'semiphemeral-api-client';
import type { DeviceInfo } from '../types';

export class BaseViewModel {
    public account: Account;
    public webview: WebviewTag;
    public api: SemiphemeralAPIClient;
    public deviceInfo: DeviceInfo | null;
    public webContentsID: number | null;
    public isWebviewDestroyed: boolean;

    public state: string;
    public action: string;
    public actionString: string;
    public actionFinishedString: string;
    public domReady: boolean;
    public isPaused: boolean;

    public showBrowser: boolean;
    public instructions: string;

    private domReadyHandler: () => void;

    constructor(account: Account, webview: WebviewTag, api: SemiphemeralAPIClient, deviceInfo: DeviceInfo | null) {
        this.account = account;
        this.webview = webview;
        this.api = api;
        this.deviceInfo = deviceInfo;
        this.webContentsID = null;
        this.isWebviewDestroyed = false;

        this.state = "";
        this.action = "";
        this.actionString = "";
        this.actionFinishedString = "";
        this.instructions = "";
        this.showBrowser = false;
        this.domReady = false;
        this.isPaused = false;

        this.domReadyHandler = async () => {
            this.log("domReadyHandler", "dom-ready");
            await new Promise(resolve => setTimeout(resolve, 200));

            // dom-ready has been fired
            this.domReady = true;

            const webview = this.getWebview();
            if (webview) {
                // Set the webContentsID
                this.webContentsID = webview.getWebContentsId();

                // Remove the event listener
                webview.removeEventListener("dom-ready", this.domReadyHandler);
            }
        }
        this.getWebview()?.addEventListener("dom-ready", this.domReadyHandler);
    }

    async init() {
        // Open devtools if needed
        if (await window.electron.shouldOpenDevtools()) {
            this.getWebview()?.openDevTools();
        }

        // Wait for dom-ready
        while (!this.domReady) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    destroy() {
        this.isWebviewDestroyed = true;
    }

    getWebview(): WebviewTag | null {
        if (this.isWebviewDestroyed) {
            return null;
        }
        return this.webview;
    }

    log(func: string, message: string) {
        console.log(`AccountXViewModel.${func} (${this.state}): ${message}`);
    }

    async waitForLoadingToFinish() {
        do {
            await new Promise(resolve => setTimeout(resolve, 200));
        } while (this.getWebview()?.isLoading());
    }

    async sleep(ms: number) {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    async waitForSelector(selector: string, timeout: number = 3000) {
        const startingURL = this.webview.getURL();

        const startTime = Date.now();
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`Timeout waiting for selector: ${selector}`);
            }
            const found = await this.getWebview()?.executeJavaScript(`document.querySelector('${selector}') !== null`);
            if (found) {
                console.log("waitForSelector", `found: ${selector}`);
                break;
            }
            await this.sleep(200);

            // Check if the URL has changed
            if (this.webview.getURL() !== startingURL) {
                console.log("waitForSelector", `URL changed: ${this.webview.getURL()}`);
                throw new Error("URL changed while waiting for selector");
            }
        }
    }

    async loadURL(url: string) {
        console.log("AccountXViewModel.loadURL", url);
        const webview = this.getWebview();
        if (webview) {
            const tries = 0;
            while (tries < 3) {
                try {
                    await webview.loadURL(url);
                    break;
                } catch (error) {
                    console.error(`Failed to load URL: ${error}`);
                    await this.sleep(500);
                }
            }
        }
        await this.waitForLoadingToFinish();
    }

    async waitForURL(url: string) {
        console.log("waitForURL", url);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const newURL = this.getWebview()?.getURL();
            this.log("waitForURL", `waiting... currently: ${newURL}`);
            if (newURL == url) {
                break;
            }
            await this.sleep(500);
        }
    }

    // Return true if we scrolled, and false if we can't scroll anymore
    async scrollToBottom() {
        await this.waitForPause();

        // Find the last scroll position
        const scrollTop = await this.getWebview()?.executeJavaScript("document.documentElement.scrollTop || document.body.scrollTop");

        // Scroll to the bottom
        this.log("scrollToBottom", "scrolling to bottom")
        await this.getWebview()?.executeJavaScript("window.scrollTo(0, document.body.scrollHeight)");
        await this.sleep(500);
        await this.waitForLoadingToFinish();

        // Have we scrolled?
        const newScrollTop = await this.getWebview()?.executeJavaScript("document.documentElement.scrollTop || document.body.scrollTop");
        if (newScrollTop === scrollTop) {
            return false;
        }
        return true;
    }

    // Return true if we scrolled, and false if we can't scroll anymore
    async scrollToTop(selector: string) {
        // Find the last scroll position
        const scrollTop = await this.getWebview()?.executeJavaScript(`
        (() => {
            let el = document.querySelector('${selector}');
            if(el === null) { return false; }
            return el.scrollTop;
        })()
        `);

        await this.waitForLoadingToFinish();
        await this.sleep(500);

        // Scroll to the top
        this.log("scrollToTop", "scrolling to top")
        await this.getWebview()?.executeJavaScript(`
        (() => {
            let el = document.querySelector('${selector}');
            if(el === null) { return false; }
            el.scrollTo(0,0);
        })()
        `);
        await this.sleep(500);
        await this.waitForLoadingToFinish();

        // Have we scrolled?
        const newScrollTop = await this.getWebview()?.executeJavaScript(`
            (() => {
                let el = document.querySelector('${selector}');
                if(el === null) { return false; }
                return el.scrollTop;
            })()
        `);
        if (newScrollTop === scrollTop) {
            return false;
        }
        return true;
    }

    async scrollUp(height: number) {
        await this.getWebview()?.executeJavaScript(`window.scrollBy(0, -${height})`);
        await this.sleep(500);
        await this.waitForLoadingToFinish();
    }

    async scriptClickElement(selector: string): Promise<boolean> {
        const code = `
        (() => {
            let el = document.querySelector('${selector}');
            if(el === null) { return false; }
            el.click();
            return true;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    async scriptGetInnerText(selector: string): Promise<null | string> {
        const code = `
        (() => {
            let el = document.querySelector('${selector}');
            if(el === null) { return null; }
            return el.innerText;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    async scriptGetAllInnerHTML(selector: string): Promise<string[]> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            const elsHTML = Array.from(els).map(el => el.innerHTML);
            return elsHTML;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    // Pause and resume the jobs

    pause() {
        this.isPaused = true;
        this.log("pause", "paused");
    }

    resume() {
        this.isPaused = false;
        this.log("resume", "resumed");
    }

    async waitForPause() {
        while (this.isPaused) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
}