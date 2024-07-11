// import * as cheerio from 'cheerio';

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
    private fetchTweetsDone: boolean = false;

    async init() {
        this.state = State.Login;
        super.init();
    }

    log(func: string, message: string) {
        console.log(`AccountXViewModel.${func} (${this.state}): ${message}`);
    }

    // async parseTweetHTMLs() {
    //     for (const tweetHTML of this.tweetHTMLs) {
    //         const $ = cheerio.load(tweetHTML);

    //         const userNameDiv = $('div[data-testid="User-Name"]');
    //         if (userNameDiv.length === 0) {
    //             this.log("parseTweetHTMLs", "no User-Name div found");
    //             continue;
    //         }

    //         const links = userNameDiv.find('a');
    //         if (links.length !== 3) {
    //             this.log("parseTweetHTMLs", `unexpected number of links: ${links.length}`);
    //             continue;
    //         }

    //         const tweetLink = links[2];
    //         const path = $(tweetLink).attr('href');
    //         if (path === undefined) {
    //             this.log("parseTweetHTMLs", "no href found");
    //             continue;
    //         }

    //         // tweetPath is like: '/nexamind91325/status/1780651436629750204'
    //         const pathParts = path.split("/");
    //         if (pathParts.length !== 4) {
    //             this.log("parseTweetHTMLs", `unexpected number of parts: ${pathParts.length}`);
    //             continue;
    //         }

    //         const username = pathParts[1];
    //         const tweetId = pathParts[3];

    //         const timestampStr = $('time').attr('datetime');
    //         if (timestampStr === undefined) {
    //             this.log("parseTweetHTMLs", "no datetime found");
    //             continue;
    //         }

    //         const timestamp = new Date(timestampStr);

    //         const tweetTextDiv = $('div[data-testid="tweetText"]');
    //         if (tweetTextDiv.length === 0) {
    //             this.log("parseTweetHTMLs", "no tweetText div found");
    //             continue;
    //         }

    //         const text = tweetTextDiv.text();

    //         // const tweet: XTweet = {
    //         //     xAccountId: this.account.xAccount?.id ?? 0,
    //         //     tweetId: tweetId,
    //         //     username: username,
    //         //     timestamp: timestamp,
    //         // }

    //         // const tweetID = $('article').attr('data-id');
    //         // const tweetText = $('article [data-testid="tweet"]').text();
    //         // console.log(`Tweet ID: ${tweetID}, Text: ${tweetText}`);

    //         // tweet id
    //         // text
    //         // date
    //         // retweets
    //         // likes
    //     }
    // }

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
                    await window.electron.database.saveAccount(JSON.stringify(this.account));

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
                this.fetchTweetsDone = false;
                this.showBrowser = true;
                this.instructions = `
Hang on while I scroll down to your very earliest tweet.
`;
                // Start monitoring network requests
                await window.electron.X.fetchStart(this.account.id);

                // Load the timeline and wait for tweets to appear
                await this.loadURL("https://x.com/" + this.account.xAccount?.username + "/with_replies");
                await this.waitForSelector('article');

                // Scroll to bottom
                await this.scrollToBottom();

                // Stop monitoring network requests
                await window.electron.X.fetchStop(this.account.id);

                // Parse tweets
                this.instructions = `
Now I'm looking through all your tweets...
`;
                this.fetchTweetsDone = await window.electron.X.fetchParse(this.account.id);
                console.log("done", this.fetchTweetsDone);

                await new Promise(resolve => setTimeout(resolve, 60000));

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