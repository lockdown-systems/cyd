import { BaseViewModel } from './BaseViewModel';

export enum State {
    Login = "login",
    Dashboard = "dashboard",
    DashboardDisplay = "dashboardDisplay",
    Download = "download",
    DownloadTweets = "downloadTweets",
    DownloadDirectMessages = "downloadDirectMessages",
    DownloadComplete = "downloadComplete",
    Delete = "delete",
}

export class AccountXViewModel extends BaseViewModel {
    async init() {
        this.state = State.Login;
        super.init();
    }

    log(func: string, message: string) {
        console.log(`AccountXViewModel.${func} (${this.state}): ${message}`);
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
                    await this.loadURL("https://x.com/i/flow/login");
                    await this.waitForURL("https://x.com/home");

                    // We're logged in
                    this.log("run", "login succeeded");

                    // Get the username
                    const username = await this.getUsername();
                    if (username === null) {
                        this.log("run", "failed to get username");

                        // TODO: automation error
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
                    await this.loadURL("https://x.com/i/flow/login");
                    await new Promise(resolve => setTimeout(resolve, 500));

                    if (this.webview.getURL() == "https://x.com/home") {
                        this.log("run", "login succeeded");

                        // Get the username
                        const username = await this.getUsername();
                        if (username === null) {
                            this.log("run", "failed to get username");

                            // TODO: automation error
                            break;
                        }

                        if (this.account.xAccount?.username !== username) {
                            console.log(`Username changed from ${this.account.xAccount?.username} to ${username}`);
                            // TODO: username changed error
                            break;
                        }

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
                this.instructions = `What would you like to do?`;
                this.state = State.DashboardDisplay;
                break;

            case State.Download:
                // Start with tweets
                if (this.account.xAccount?.archiveTweets) {
                    this.state = State.DownloadTweets;
                    break;
                }

                // Or skip to DMs
                this.state = State.DownloadDirectMessages;
                break;

            case State.DownloadTweets:
                this.showBrowser = true;
                this.instructions = `
Hang tight while I archive your tweets...
`;
                await this.loadURL("https://x.com/" + this.account.xAccount?.username + "/with_replies");

                // TODO: implement
                await new Promise(resolve => setTimeout(resolve, 10000));

                // Where next?
                if (this.account.xAccount?.archiveDirectMessages) {
                    this.state = State.DownloadDirectMessages;
                } else {
                    this.state = State.DownloadComplete;
                }
                break;

            case State.DownloadDirectMessages:
                // TODO: implement

                // Where next?
                this.state = State.DownloadComplete;
                break;

            case State.DownloadComplete:
            case State.Delete:
                break;

        }
    }
}