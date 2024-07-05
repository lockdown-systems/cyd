import { BaseViewModel } from './BaseViewModel';

export enum State {
    Login = "login",
    Dashboard = "dashboard",
    DashboardDisplay = "dashboardDisplay",
    DownloadArchive = "downloadArchive",
    UnlikeTweets = "unlikeTweets",
    FinishUnlikeTweets = "finishUnlikeTweets",
    DeleteTweets = "deleteTweets",
    FinishDeleteTweets = "finishDeleteTweets",
    DeleteDirectMessages = "deleteDirectMessages",
    FinishDeleteDirectMessages = "finishDeleteDirectMessages",
}

export class AccountXViewModel extends BaseViewModel {
    async init() {
        this.state = State.Login;
        super.init();
    }

    log(func: string, message: string) {
        console.log(`AccountXViewModel.${func} (${this.state}): ${message}`);
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
        await this.waitForWebviewReady();

        switch (this.state) {
            case State.Login:
                // Never logged in before
                if (this.account.xAccount?.username === null) {
                    this.instructions = `
I can help you automatically archive your tweets and/or direct messages, and then delete your tweets, likes,
and direct messages, except for the ones you want to keep. **To start, login to your X account below.**
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
                    this.account.xAccount.username = username;
                    await window.electron.saveAccount(JSON.stringify(this.account));

                    this.state = State.Dashboard;

                } else {
                    // We have logged in before. Are we currently logged in?
                    this.instructions = `
Checking to see if you're still logged in to your X account...
`;
                    this.showBrowser = true;
                    await this.loadURL("https://x.com/login");
                    await new Promise(resolve => setTimeout(resolve, 500));

                    if (this.webview.getURL() == "https://x.com/home") {
                        this.log("run", "login succeeded");
                        this.state = State.Dashboard;
                    } else {
                        this.instructions = `
You've been logged out. **To continue, log back into your X account below.**
`;
                        await this.waitForURL("https://x.com/home");
                        this.log("run", "login succeeded");
                        this.state = State.Dashboard;
                    }
                }
                break;

            case State.Dashboard:
                this.showBrowser = false;
                await this.loadURL("about:blank");
                this.instructions = `What would you like to do next?`;
                this.state = State.DashboardDisplay;
                break;

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