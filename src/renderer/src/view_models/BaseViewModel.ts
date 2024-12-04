import { WebviewTag } from 'electron';
import { Emitter, EventType } from 'mitt';
import type { Account } from '../../../shared_types';
import { PlausibleEvents } from '../types';
import { AutomationErrorType } from '../automation_errors';
import { logObj } from '../util';

const DEFAULT_TIMEOUT = 30000;

type Log = {
    timestamp: string; // ISO string
    func: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message?: any;
};

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
    public logs: Log[] = [];

    public account: Account;
    public webview: WebviewTag | null;
    public webContentsID: number | null;
    public isWebviewDestroyed: boolean;

    public state: string;
    public action: string;
    public actionString: string;
    public actionFinishedString: string;
    public domReady: boolean;

    public isPaused: boolean;

    // If the computer resumes from sleep, should we resume the automation?
    public shouldResumeOnResume: boolean;
    // Only allow the suspend events to be triggerer once at a time
    public suspendLock: boolean;

    public showBrowser: boolean;
    public showAutomationNotice: boolean;
    public instructions: string;

    public emitter: Emitter<Record<EventType, unknown>> | null;

    public domReadyHandler: () => void;

    constructor(account: Account, emitter: Emitter<Record<EventType, unknown>> | null) {
        this.account = account;
        this.webview = null;
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
        this.shouldResumeOnResume = false;
        this.suspendLock = false;

        this.emitter = emitter;

        this.resetLogs();

        this.domReadyHandler = async () => { };

        // Suspend and resume
        window.electron.onPowerMonitorSuspend(() => this.powerMonitorSuspend());
        window.electron.onPowerMonitorResume(() => this.powerMonitorResume());
    }

    cleanup() {
        // Remove the event listener
        this.getWebview()?.removeEventListener("dom-ready", this.domReadyHandler);
    }

    async reloadAccount() {
        this.log("reloadAccount");
        const account = await window.electron.database.getAccount(this.account.id);
        if (account) {
            this.account = account;
        }
    }

    powerMonitorSuspend() {
        if (this.suspendLock) {
            this.log("powerMonitorSuspend", "already got the suspend event, so skipping");
            return;
        }
        this.suspendLock = true;

        if (this.isPaused) {
            this.log("powerMonitorSuspend", "already paused");
            this.shouldResumeOnResume = false;
        } else {
            this.log("powerMonitorSuspend", "pausing, will auto-resume on wake");
            this.shouldResumeOnResume = true;
            this.pause();
        }
    }

    powerMonitorResume() {
        this.suspendLock = false;

        if (this.shouldResumeOnResume) {
            this.log("powerMonitorResume", "resuming");
            this.resume();
        } else {
            this.log("powerMonitorResume", "was already paused");
        }
    }

    async init(webview: WebviewTag) {
        this.webview = webview;

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
        this.logs.push({
            timestamp: new Date().toISOString(),
            func: func,
            message: message,
        });

        // Cap this.logs to at most 20 items
        if (this.logs.length > 20) {
            this.logs.shift();
        }

        if (message === undefined) {
            console.log(`${this.account?.type}[${this.account?.id}] ${func} (${this.state})`);
        } else {
            console.log(`${this.account?.type}[${this.account?.id}] ${func} (${this.state}):`, logObj(message));
        }
    }

    resetLogs() {
        this.logs = [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async error(automationErrorType: AutomationErrorType, errorReportData: any = null, sensitiveContextData: any = null, allowContinue: boolean = false) {
        console.error(`Automation Error: ${automationErrorType}`, errorReportData, sensitiveContextData);

        // Submit progress to the API
        this.emitter?.emit(`x-submit-progress-${this.account?.id}`);

        await window.electron.trackEvent(PlausibleEvents.AUTOMATION_ERROR_OCCURED, navigator.userAgent);
        const webview = this.getWebview();

        // Get username
        let username = "";
        switch (this.account?.type) {
            case "X":
                username = this.account?.xAccount?.username ? this.account?.xAccount.username : "";
                break;
            default:
                break;
        }

        // Get screenshot
        let screenshotDataURL = "";
        if (webview && this.showBrowser) {
            screenshotDataURL = (await webview.capturePage()).toDataURL();
        }

        // Add logs to sensitiive context data
        if (sensitiveContextData === null) {
            sensitiveContextData = {};
        }
        sensitiveContextData.logs = this.logs;

        // Add current URL to sensitive context data
        if (webview) {
            sensitiveContextData.currentURL = webview.getURL();
        }

        // Create the error
        await window.electron.database.createErrorReport(
            this.account.id,
            this.account.type,
            automationErrorType,
            JSON.stringify(errorReportData),
            username,
            screenshotDataURL,
            JSON.stringify(sensitiveContextData)
        );

        if (!allowContinue) {
            await this.showErrorModal();
        }
    }

    async showErrorModal() {
        // Show the error modal
        this.emitter?.emit("show-automation-error", this.account.id);

        this.pause()
        await this.waitForPause();
    }

    async waitForLoadingToFinish(timeout: number = DEFAULT_TIMEOUT) {
        this.log("waitForLoadingToFinish", "waiting for loading to finish");
        const startTime = Date.now();
        do {
            await new Promise(resolve => setTimeout(resolve, 200));
            if (Date.now() - startTime >= timeout) {
                this.log("waitForLoadingToFinish", "timeout reached while waiting for loading to finish");
                return;
            }
        } while (this.getWebview()?.isLoading());
        this.log("waitForLoadingToFinish", "loading finished");
    }

    async sleep(ms: number) {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    async getScrollHeight() {
        return await this.getWebview()?.executeJavaScript("document.body.scrollHeight");
    }

    async waitForSelector(selector: string, startingURL: string = '', timeout: number = DEFAULT_TIMEOUT) {
        if (this.webview === null) {
            this.log("waitForSelector", "webview is null");
            return;
        }

        if (startingURL == '') {
            startingURL = this.webview.getURL();
        }

        const startTime = Date.now();
        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Check if the URL has changed
            if (this.webview.getURL() !== startingURL) {
                this.log("waitForSelector", `URL changed: ${this.webview.getURL()}`);
                throw new URLChangedError(startingURL, this.webview.getURL());
            }

            // Check if we have timed out
            if (Date.now() - startTime > timeout) {
                throw new TimeoutError(selector);
            }

            // Did we find the selector?
            const found = await this.getWebview()?.executeJavaScript(`document.querySelector('${selector}') !== null`);
            if (found) {
                this.log("waitForSelector", `found: ${selector}`);
                break;
            }
            await this.sleep(200);
        }
    }

    async doesSelectorExist(selector: string): Promise<boolean> {
        return await this.getWebview()?.executeJavaScript(`document.querySelector('${selector}') !== null`);
    }

    // if the last element in the list of elements that match containerSelector, and check if selector exists
    async doesSelectorWithinElementLastExist(containerSelector: string, selector: string): Promise<boolean> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${containerSelector}');
            if(els.length == 0) { return false; }
            const lastEl = els[els.length - 1];
            const innerEl = lastEl.querySelector('${selector}');
            if(innerEl === null) { return false; }
            return true;
        })()
        `;
        await this.sleep(250);
        return await this.getWebview()?.executeJavaScript(code);
    }

    async isSelectorLastDisabled(selector: string): Promise<boolean> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length == 0) { return false; }
            const lastEl = els[els.length - 1];
            return lastEl.disabled;
        })()
        `;
        await this.sleep(250);
        return await this.getWebview()?.executeJavaScript(code);
    }

    async countSelectorsFound(selector: string): Promise<number> {
        return await this.getWebview()?.executeJavaScript(`document.querySelectorAll('${selector}').length`);
    }

    // Count the number of selector elements within the last element in the list of elements that match containerSelector
    async countSelectorsWithinElementLastFound(containerSelector: string, selector: string): Promise<number> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${containerSelector}');
            if(els.length == 0) { return 0; }
            const lastEl = els[els.length - 1];
            const innerEls = lastEl.querySelectorAll('${selector}');
            return innerEls.length;
        })()
        `;
        await this.sleep(250);
        return await this.getWebview()?.executeJavaScript(code);
    }

    // wait for containerSelector to exist, and also selector within containerSelector to exist
    async waitForSelectorWithinSelector(containerSelector: string, selector: string, timeout: number = DEFAULT_TIMEOUT) {
        if (this.webview === null) {
            this.log("waitForSelector", "webview is null");
            return;
        }

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
                this.log("waitForSelectorWithinSelector", `found: ${selector}`);
                break;
            }
            await this.sleep(200);

            // Check if the URL has changed
            if (this.webview.getURL() !== startingURL) {
                this.log("waitForSelectorWithinSelector", `URL changed: ${this.webview.getURL()}`);
                throw new URLChangedError(startingURL, this.webview.getURL());
            }
        }
    }

    async checkInternetConnectivity(): Promise<boolean> {
        const apiURL = await window.electron.getAPIURL();
        const testURL = `${apiURL}/health`;
        if (!testURL) {
            this.log("checkInternetConnectivity", "apiURL is not set");
            return false;
        }
        try {
            await fetch(testURL, { method: "HEAD", signal: AbortSignal.timeout(2000) });
            this.log("checkInternetConnectivity", "internet is up");
            return true;
        } catch (error) {
            this.log("checkInternetConnectivity", `internet is down: ${(error as Error).toString()}`);
            return false;
        }
    }

    async loadBlank() {
        this.log("loadBlank");
        const webview = this.getWebview();
        if (webview) {
            // Note: We need to wait for the page to finish loading before and after this to prevent
            // Error: Error invoking remote method 'ELECTRON_GUEST_VIEW_MANAGER_CALL'
            // https://github.com/electron/electron/issues/24171#issuecomment-953053293
            await this.waitForLoadingToFinish();
            await webview.loadURL("about:blank")
            await this.waitForLoadingToFinish();
        }
    }

    async loadURL(url: string) {
        const webview = this.getWebview();
        if (webview) {
            let tries = 0;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                try {
                    this.log("loadURL", `try #${tries}, ${url}`);
                    await webview.loadURL(url);
                    // Sleep 2 seconds after loading each URL, to make everything more stable.
                    // The X rate limits are intense, so this should not slow anything down.
                    this.sleep(2000);
                    this.log("loadURL", "URL loaded successfully");
                    break;
                } catch (error) {
                    this.log("loadURL", ["Failed to load URL", error]);
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
        } else {
            this.log("loadURL", "webview is null");
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

            await this.sleep(250);
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
        await this.sleep(1000);
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
        await this.sleep(250);
        return await this.getWebview()?.executeJavaScript(code);
    }

    // click the Nth element in the list of elements that match selector
    async scriptClickElementNth(selector: string, n: number): Promise<boolean> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length < ${n + 1}) { return false; }
            const firstEl = els[${n}];
            firstEl.click()
            return true;
        })()
        `;
        await this.sleep(250);
        return await this.getWebview()?.executeJavaScript(code);
    }

    // click the first element in the list of elements that match selector
    async scriptClickElementFirst(selector: string): Promise<boolean> {
        return await this.scriptClickElementNth(selector, 0);
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
        await this.sleep(250);
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
        await this.sleep(250);
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
        await this.sleep(250);
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
        await this.sleep(250);
        return await this.getWebview()?.executeJavaScript(code);
    }

    // mouseover the Nth element in the list of elements that match selector
    async scriptMouseoverElementNth(selector: string, n: number): Promise<boolean> {
        const code = `
        (() => {
            const els = document.querySelectorAll('${selector}');
            if(els.length < ${n + 1}) { return false; }
            const firstEl = els[${n}];
            firstEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
            return true;
        })()
        `;
        await this.sleep(250);
        return await this.getWebview()?.executeJavaScript(code);
    }

    // mouseover the first element in the list of elements that match selector
    async scriptMouseoverElementFirst(selector: string): Promise<boolean> {
        return await this.scriptMouseoverElementNth(selector, 0);
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
        await this.sleep(250);
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
        if (!this.isPaused) {
            return;
        }

        while (this.isPaused) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        this.log("waitForPause", "resumed");
    }
}