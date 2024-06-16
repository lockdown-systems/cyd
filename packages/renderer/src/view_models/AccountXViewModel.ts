import Electron from 'electron';

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
    private webviewReady: boolean;

    public showBrowser: boolean;
    public instructions: string;

    constructor(account: XAccount, webview: Electron.WebviewTag) {
        console.log("AccountXViewModel initialized");
        this.account = account;
        this.webview = webview;

        this.state = State.Login;
        this.webviewReady = false;
        this.instructions = "";
        this.showBrowser = false;

        // Wait for the webview to finish loading
        this.webview.addEventListener("dom-ready", () => {
            this.webviewReady = true;
            console.log("AccountXViewModel: webview is ready");
        });
    }

    log(func: string, message: string) {
        console.log(`AccountXViewModel.${func} (${this.state}): ${message}`);
    }

    async waitForWebviewReady() {
        while (!this.webviewReady) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        this.webview.openDevTools();
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

    async getUsername(): Promise<string> {
        this.log("getUsername", "getting username");
        const code = `
        (() => {
            // Click the profile icon
            let profileIconEl = document.querySelector('[data-testid="DashButton_ProfileIcon_Link"]')
            if(profileIconEl === null) {
                return "";
            }
            profileIconEl.click();

            // Find the account div on the sidebar
            let accountEl = document.querySelector('div[aria-label="Account"]');
            if(accountEl === null) {
                return "";
            }

            // Get the profile button
            let profileEl = accountEl.parentElement.children[1];
            if(profileEl === null) {
                return "";
            }

            // Get the profile link
            linkEl = profileEl.querySelector('a');
            if(linkEl === null) {
                return "";
            }

            // Get the username from the link
            let username = linkEl.getAttribute("href");
            username = username.replace(/^\\//, "");
            return username;
        })()
        `;
        const resp = await this.webview.executeJavaScript(code);
        console.log("Username is " + resp);
        return resp;
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
                    await this.webview.loadURL("https://x.com/login");

                    if (!await this.loginPageTests()) {
                        this.log("run", "login page tests failed");
                        // TODO: display error message / report automation test errors
                    }

                    // Wait for the URL to be https://twitter.com/home, which means the login succeeded
                    let loggedIn = false;
                    while (!loggedIn) {
                        const url = this.webview.getURL();
                        this.log("run", `current URL: ${url}`);
                        if (url == "https://x.com/home") {
                            break;
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                    // We're logged in, get the username
                    this.log("run", "login succeeded");

                    //this.account.username = await this.getUsername();

                    const resp = await this.webview.executeJavaScript(`(() => { console.log("does it work at all?"); alert('test'); return "test"; })`);
                    console.log("Response", typeof resp, resp);



                } else {
                    // We have logged in before. Are we currently logged in?
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