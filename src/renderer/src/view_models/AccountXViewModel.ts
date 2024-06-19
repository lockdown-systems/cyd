import Electron from 'electron';
import { XAccount } from '../types';

export enum State {
    Login = "login",
    Dashboard = "dashboard",
    DownloadArchive = "downloadArchive",
    UnlikeTweets = "unlikeTweets",
    FinishUnlikeTweets = "finishUnlikeTweets",
    DeleteTweets = "deleteTweets",
    FinishDeleteTweets = "finishDeleteTweets",
    DeleteDirectMessages = "deleteDirectMessages",
    FinishDeleteDirectMessages = "finishDeleteDirectMessages",
}

export class AccountXViewModel {
    private account: XAccount;
    private state: string;
    private webview: Electron.WebviewTag;
    private ready: boolean;

    public showBrowser: boolean;
    public instructions: string;

    constructor(account: XAccount, webview: Electron.WebviewTag) {
        this.account = account;
        this.webview = webview;

        this.state = State.Login;
        this.instructions = "";
        this.showBrowser = false;
        this.ready = false;

        // Wait for the webview to finish loading
        this.webview.addEventListener("dom-ready", () => {
            const url = this.webview.getURL();
            console.log("AccountXViewModel: dom-ready", url);
            this.ready = true;
        });
    }

    async init() {
        // Open dev tools in local or staging, but not in production
        if (await window.electron.isDevMode()) {
            this.webview.openDevTools();
        }
    }

    log(func: string, message: string) {
        console.log(`AccountXViewModel.${func} (${this.state}): ${message}`);
    }

    async waitForWebviewReady() {
        this.ready = false;
        while (!this.ready) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    async loadURL(url: string) {
        console.log("AccountXViewModel.loadURL", url);
        await this.webview.loadURL(url);
        await this.waitForWebviewReady();
    }

    async waitForURL(url: string) {
        console.log("waitForURL", url);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const newURL = this.webview.getURL();
            this.log("waitForURL", `waiting... currently: ${newURL}`);
            if (newURL == url) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
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
        return await this.webview.executeJavaScript(code);
    }

    async scriptGetInnerText(selector: string): Promise<null | string> {
        const code = `
        (() => {
            let el = document.querySelector('${selector}');
            if(el === null) { return null; }
            return el.innerText;
        })()
        `;
        return await this.webview.executeJavaScript(code);
    }

    async loginPageTests(): Promise<boolean> {
        this.log("loginPageTests", "running tests")
        // TODO: implement
        return true;
    }

    async homepagePageTests(): Promise<boolean> {
        this.log("homepagePageTests", "running tests")
        // TODO: implement
        return true;
    }

    async getUsername(): Promise<null | string> {
        await new Promise(resolve => setTimeout(resolve, 500));

        const clickResp = await this.scriptClickElement('[data-testid="AppTabBar_Profile_Link"]')
        if (!clickResp) {
            this.log("getUsername", "failed to click profile link")
            return null;
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        const usernameInnerText = await this.scriptGetInnerText('[data-testid="UserName"]');
        if (usernameInnerText === null) {
            this.log("getUsername", "failed to get username innerText")
            return null;
        }

        const parts = usernameInnerText.split("@");
        if (parts.length !== 2) {
            this.log("getUsername", `invalid innerText: ${usernameInnerText}`)
            return null;
        }

        const username = parts[1];
        this.log("getUsername", `got username: ${username}`);
        return username;
    }

    async run() {
        this.log("run", "running")

        switch (this.state) {
            case State.Login:
                // Never logged in before
                if (this.account.username === null) {
                    this.instructions = `
I can help you automatically delete your tweets, likes, and direct messages, 
except for the ones you want to keep. **To start, login to your X account below.**
`;
                    this.showBrowser = true;
                    await this.loadURL("https://x.com/login");

                    if (!await this.loginPageTests()) {
                        this.log("run", "login page tests failed");
                        // TODO: display error message / report automation test errors
                    }

                    await this.waitForURL("https://x.com/home");

                    // We're logged in
                    this.log("run", "login succeeded");

                    // Get the username
                    const username = await this.getUsername();
                    if (username === null) {
                        this.log("run", "failed to get username");
                        break;
                    }

                    // Save it
                    this.account.username = username;
                    await window.electron.saveXAccount(JSON.stringify(this.account));

                    // TODO: redirect to dashboard

                } else {
                    // We have logged in before. Are we currently logged in?
                    this.instructions = `
Checking to see if you're still logged in to your X account...
`;
                    this.showBrowser = true;
                    await this.loadURL("https://x.com/login");

                    if (this.webview.getURL() == "https://x.com/home") {
                        // We're logged in
                        this.log("run", "login succeeded");

                        // TODO: redirect to dashboard
                    } else {
                        this.instructions = `
You've been logged out. **To continue, log back into your X account below.**
`;
                    }
                }

                break;

            case State.Dashboard:
            case State.DownloadArchive:
            case State.UnlikeTweets:
            case State.FinishUnlikeTweets:
            case State.DeleteTweets:
            case State.FinishDeleteTweets:
            case State.DeleteDirectMessages:
            case State.FinishDeleteDirectMessages:
                break;

        }
    }
}