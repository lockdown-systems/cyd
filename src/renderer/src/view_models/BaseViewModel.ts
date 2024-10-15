import { WebviewTag } from 'electron';
import { Emitter, EventType } from 'mitt';
import type { Account } from '../../../shared_types';
import SemiphemeralAPIClient from '../../../semiphemeral-api-client';
import { type DeviceInfo, PlausibleEvents } from '../types';
import { AutomationErrorType, AutomationErrorDetails } from '../automation_errors';
import { logObj } from '../util';

export class TimeoutError extends Error {
    constructor(selector: string) {
        super(`Timeout waiting for selector: ${selector}`);
        this.name = "TimeoutError";
    }
}

export class URLChangedError extends Error {
    constructor(oldURL: string, newURL: string, validURLs: string[] = []) {
        let errorMessage = `URL changed from ${oldURL} to ${newURL}`;
        if (validURLs.length > 0) {
            errorMessage += ` (valid URLs: ${validURLs.join(", ")})`;
        }
        super(errorMessage);
        this.name = "URLChangedError";
    }
}

export class InternetDownError extends Error {
    constructor() {
        super(`Internet connection is down`);
        this.name = "InternetDownError";
    }
}

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
    public showAutomationNotice: boolean;
    public instructions: string;

    public emitter: Emitter<Record<EventType, unknown>> | null;

    private domReadyHandler: () => void;

    constructor(account: Account, webview: WebviewTag, api: SemiphemeralAPIClient, deviceInfo: DeviceInfo | null, emitter: Emitter<Record<EventType, unknown>> | null) {
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
        this.showAutomationNotice = false;
        this.domReady = false;
        this.isPaused = false;

        this.emitter = emitter;

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
        const shouldOpenDevtools = await window.electron.shouldOpenDevtools();

        if (shouldOpenDevtools) {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log(func: string, message?: any) {
        if (message === undefined) {
            console.log(`${this.constructor.name}.${func} (${this.state})`);
        } else {
            console.log(`${this.constructor.name}.${func} (${this.state}):`, logObj(message));
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async error(automationErrorType: AutomationErrorType, errorReportData: any = null, sensitiveContextData: any = null) {
        console.error(`Automation Error: ${automationErrorType}`, errorReportData, sensitiveContextData);

        await window.electron.trackEvent(PlausibleEvents.AUTOMATION_ERROR_OCCURED, navigator.userAgent);

        // Get username
        let username = "";
        switch (this.account.type) {
            case "X":
                username = this.account.xAccount?.username ? this.account.xAccount.username : "";
                break;
            default:
                break;
        }

        // Get screenshot
        let screenshotDataURL = "";
        const webview = this.getWebview();
        if (webview) {
            screenshotDataURL = (await webview.capturePage()).toDataURL();
        }

        const details: AutomationErrorDetails = {
            accountID: this.account.id,
            accountType: this.account.type,
            automationErrorType: automationErrorType,
            errorReportData: errorReportData,
            username: username,
            screenshotDataURL: screenshotDataURL,
            sensitiveContextData: sensitiveContextData,
        };

        // Show the error modal
        this.emitter?.emit("show-automation-error");
        // Wait for it to appear
        await new Promise(resolve => setTimeout(resolve, 200));
        // Set the data
        this.emitter?.emit("set-automation-error-details", details);

        this.pause()
        await this.waitForPause();
    }

    async waitForLoadingToFinish() {
        do {
            await new Promise(resolve => setTimeout(resolve, 200));
        } while (this.getWebview()?.isLoading());
    }

    async sleep(ms: number) {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    async waitForSelector(selector: string, startingURL: string = '', timeout: number = 5000) {
        if (startingURL == '') {
            startingURL = this.webview.getURL();
        }

        const startTime = Date.now();
        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Check if the URL has changed
            if (this.webview.getURL() !== startingURL) {
                console.log("waitForSelector", `URL changed: ${this.webview.getURL()}`);
                throw new URLChangedError(startingURL, this.webview.getURL());
            }

            // Check if we have timed out
            if (Date.now() - startTime > timeout) {
                throw new TimeoutError(selector);
            }

            // Did we find the selector?
            const found = await this.getWebview()?.executeJavaScript(`document.querySelector('${selector}') !== null`);
            if (found) {
                console.log("waitForSelector", `found: ${selector}`);
                break;
            }
            await this.sleep(200);
        }
    }

    // wait for containerSelector to exist, and also selector within containerSelector to exist
    async waitForSelectorWithinSelector(containerSelector: string, selector: string, timeout: number = 5000) {
        const startingURL = this.webview.getURL();

        const startTime = Date.now();
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (Date.now() - startTime > timeout) {
                throw new TimeoutError(selector);
            }
            const found = await this.getWebview()?.executeJavaScript(`
                (() => {
                    const el = document.querySelector('${containerSelector}');
                    if(el === null) { return false; }
                    const innerEl = el.querySelector('${selector}');
                    if(innerEl === null) { return false; }
                    return true;
                })()
            `);
            if (found) {
                console.log("waitForSelectorWithinSelector", `found: ${selector}`);
                break;
            }
            await this.sleep(200);

            // Check if the URL has changed
            if (this.webview.getURL() !== startingURL) {
                console.log("waitForSelectorWithinSelector", `URL changed: ${this.webview.getURL()}`);
                throw new URLChangedError(startingURL, this.webview.getURL());
            }
        }
    }

    async checkInternetConnectivity(): Promise<boolean> {
        const testURL = this.api.apiURL + "/health";
        if (!testURL) {
            console.error("checkInternetConnectivity", "apiURL is not set");
            return false;
        }
        try {
            await fetch(testURL, { method: "HEAD", signal: AbortSignal.timeout(2000) });
            console.log("checkInternetConnectivity", "internet is up");
            return true;
        } catch (error) {
            console.error("checkInternetConnectivity", "internet is down", (error as Error).toString());
            return false;
        }
    }

    async loadBlank() {
        console.log("AccountXViewModel.loadBlank");
        const webview = this.getWebview();
        if (webview) {
            await webview.loadURL("about:blank")
        }
    }

    async loadURL(url: string) {
        console.log("AccountXViewModel.loadURL", url);
        const webview = this.getWebview();
        if (webview) {
            let tries = 0;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                try {
                    await webview.loadURL(url);
                    break;
                } catch (error) {
                    console.error(`Failed to load URL: ${error}`);

                    tries++;
                    if (tries >= 3) {
                        if (await this.checkInternetConnectivity()) {
                            throw error;
                        } else {
                            if (!await window.electron.showQuestion(`Error loading URL ${url}. It looks like your internet connection is down. Please check your connection and try again.`, "Retry", "Cancel")) {
                                throw new InternetDownError();
                            } else {
                                tries = 0;
                                this.sleep(1000);
                            }
                        }
                    }
                }
            }
        }
        await this.waitForLoadingToFinish();
    }

    async waitForURL(waitingForURL: string) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const newURL = this.getWebview()?.getURL();
            this.log("waitForURL", {
                waitingForURL: waitingForURL,
                currentURL: newURL,
            });

            // Check if we got the URL we were waiting for
            if (newURL?.startsWith(waitingForURL)) {
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

    // click the first element in the list of elements that match selector
    async scriptClickElementFirst(selector: string): Promise<boolean> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length == 0) { return false; }
            const firstEl = els[0];
            firstEl.click()
            return true;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    // click the last element in the list of elements that match selector
    async scriptClickElementLast(selector: string): Promise<boolean> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length == 0) { return false; }
            const lastEl = els[els.length - 1];
            lastEl.click()
            return true;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    // if the first element in the list of elements that match containerSelector, and click selector
    async scriptClickElementWithinElementFirst(containerSelector: string, selector: string): Promise<boolean> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${containerSelector}');
            if(els.length == 0) { return false; }
            const firstEl = els[0];
            const innerEl = firstEl.querySelector('${selector}');
            if(innerEl === null) { return false; }
            innerEl.click();
            return true;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    // if the last element in the list of elements that match containerSelector, and click selector
    async scriptClickElementWithinElementLast(containerSelector: string, selector: string): Promise<boolean> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${containerSelector}');
            if(els.length == 0) { return false; }
            const lastEl = els[els.length - 1];
            const innerEl = lastEl.querySelector('${selector}');
            if(innerEl === null) { return false; }
            innerEl.click();
            return true;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    async scriptMouseoverElement(selector: string): Promise<boolean> {
        const code = `
        (() => {
            let el = document.querySelector('${selector}');
            if(el === null) { return false; }
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
            return true;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    // mouseover the first element in the list of elements that match selector
    async scriptMouseoverElementFirst(selector: string): Promise<boolean> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length == 0) { return false; }
            const firstEl = els[0];
            firstEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
            return true;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    // mouseover the last element in the list of elements that match selector
    async scriptMouseoverElementLast(selector: string): Promise<boolean> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length == 0) { return false; }
            const lastEl = els[els.length - 1];
            lastEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
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