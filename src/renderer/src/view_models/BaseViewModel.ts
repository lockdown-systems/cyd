import Electron from 'electron';
import type { Account } from '../../../shared_types';

export class BaseViewModel {
    public account: Account;
    public webview: Electron.WebviewTag;
    public isWebviewDestroyed: boolean;

    public state: string;
    public domReady: boolean;
    public stoppedLoading: boolean;

    public showBrowser: boolean;
    public instructions: string;

    constructor(account: Account, webview: Electron.WebviewTag) {
        this.account = account;
        this.webview = webview;
        this.isWebviewDestroyed = false;

        this.state = "";
        this.instructions = "";
        this.showBrowser = false;
        this.domReady = false;
        this.stoppedLoading = false;

        // Wait for the webview to finish loading
        this.getWebview()?.addEventListener("did-stop-loading", async () => {
            const url = this.getWebview()?.getURL();
            this.log("did-stop-loading", url ?? "");
            await new Promise(resolve => setTimeout(resolve, 200));
            this.stoppedLoading = true;
        });

        // Figure out the first dom-ready
        this.getWebview()?.addEventListener("dom-ready", async () => {
            const url = this.getWebview()?.getURL();
            this.log("dom-ready", url ?? "");
            await new Promise(resolve => setTimeout(resolve, 200));
            this.domReady = true;

            // Remove the event listener
            this.getWebview()?.removeEventListener("dom-ready", () => { });
        });
    }

    async init() {
        // Open dev tools in local or staging, but not in production
        // if (await window.electron.isDevMode()) {
        //     this.getWebview()?.openDevTools();
        // }
    }

    destroy() {
        this.isWebviewDestroyed = true;
    }

    getWebview(): Electron.WebviewTag | null {
        if (this.isWebviewDestroyed) {
            return null;
        }
        return this.webview;
    }

    log(func: string, message: string) {
        console.log(`AccountXViewModel.${func} (${this.state}): ${message}`);
    }

    async waitForWebviewReady() {
        // Make sure dom-ready has been fired once
        while (!this.domReady) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Not loading? Then we're done
        if (!this.getWebview()?.isLoading()) {
            this.stoppedLoading = true;
            return;
        }

        // Wait for the loading to finish
        this.stoppedLoading = false;
        while (!this.stoppedLoading) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    async waitForLoadingToFinish() {
        do {
            this.log("waitForLoadingToFinish", "waiting...")
            await new Promise(resolve => setTimeout(resolve, 200));
        } while (this.getWebview()?.isLoading());
        this.log("waitForLoadingToFinish", "done");
    }

    async waitForSelector(selector: string, timeout: number = 30000) {
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
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    async loadURL(url: string) {
        console.log("AccountXViewModel.loadURL", url);
        await this.getWebview()?.loadURL(url);
        await this.waitForWebviewReady();
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
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async scrollToBottom() {
        await this.waitForLoadingToFinish();
        await new Promise(resolve => setTimeout(resolve, 1000));

        let lastScrollTop = 0;
        let newScrollTop = 0;
        do {
            // Find the last scroll position
            lastScrollTop = await this.getWebview()?.executeJavaScript("document.documentElement.scrollTop || document.body.scrollTop");

            // Scroll to the bottom
            this.log("scrollToBottom", "scrolling to bottom")
            await this.getWebview()?.executeJavaScript("window.scrollTo(0, document.body.scrollHeight)");
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.waitForLoadingToFinish();

            // Get the new scroll position
            newScrollTop = await this.getWebview()?.executeJavaScript("document.documentElement.scrollTop || document.body.scrollTop");

        } while (newScrollTop > lastScrollTop);
        this.log("scrollToBottom", "done");
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
}