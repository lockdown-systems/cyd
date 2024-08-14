import { WebviewTag } from 'electron';
import type { Account } from '../../../shared_types';

export class BaseViewModel {
    public account: Account;
    public webview: WebviewTag;
    public webContentsID: number | null;
    public isWebviewDestroyed: boolean;

    public state: string;
    public action: string;
    public actionString: string;
    public actionFinishedString: string;
    public domReady: boolean;
    public stoppedLoading: boolean;
    public isPaused: boolean;

    public showBrowser: boolean;
    public instructions: string;

    constructor(account: Account, webview: WebviewTag) {
        this.account = account;
        this.webview = webview;
        this.webContentsID = null;
        this.isWebviewDestroyed = false;

        this.state = "";
        this.action = "";
        this.actionString = "";
        this.actionFinishedString = "";
        this.instructions = "";
        this.showBrowser = false;
        this.domReady = false;
        this.stoppedLoading = false;
        this.isPaused = false;

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

            const webview = this.getWebview();
            if (webview) {
                // Remove the event listener
                webview.removeEventListener("dom-ready", () => { });

                // Set the webContentsID
                this.webContentsID = webview.getWebContentsId();
            }
        });
    }

    async init() {
        if (await window.electron.shouldOpenDevtools()) {
            this.getWebview()?.openDevTools();
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

    async waitForWebviewReady() {
        console.log("AccountXViewModel.waitForWebviewReady");

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

        console.log("AccountXViewModel.waitForWebviewReady done");
    }

    async waitForLoadingToFinish() {
        do {
            this.log("waitForLoadingToFinish", "waiting...")
            await new Promise(resolve => setTimeout(resolve, 200));
        } while (this.getWebview()?.isLoading());
        this.log("waitForLoadingToFinish", "done");
    }

    async waitForSelector(selector: string, timeout: number = 10000) {
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
        const webview = this.getWebview();
        if (webview) {
            const tries = 0;
            while (tries < 3) {
                try {
                    await webview.loadURL(url);
                    break;
                } catch (error) {
                    console.error(`Failed to load URL: ${error}`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
        await this.waitForWebviewReady();
    }

    async loadFile(filename: string) {
        console.log("AccountXViewModel.loadFile", filename);
        const webview = this.getWebview();
        if (webview) {
            const contentsID = webview.getWebContentsId();
            await window.electron.loadFileInWebview(contentsID, filename);

        }
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

    // Return true if we scrolled, and false if we can't scroll anymore
    async scrollToBottom() {
        await this.waitForPause();

        // Find the last scroll position
        const scrollTop = await this.getWebview()?.executeJavaScript("document.documentElement.scrollTop || document.body.scrollTop");

        await this.waitForLoadingToFinish();
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Scroll to the bottom
        this.log("scrollToBottom", "scrolling to bottom")
        await this.getWebview()?.executeJavaScript("window.scrollTo(0, document.body.scrollHeight)");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.waitForLoadingToFinish();

        // Have we scrolled?
        const newScrollTop = await this.getWebview()?.executeJavaScript("document.documentElement.scrollTop || document.body.scrollTop");
        if (newScrollTop === scrollTop) {
            return false;
        }
        return true;
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