import { BaseViewModel } from './BaseViewModel';
import type { XJob, XProgress, XTweet } from '../../../shared_types';

export enum State {
    Login = "login",
    Dashboard = "dashboard",
    DashboardDisplay = "dashboardDisplay",
    RunJobs = "runJobs",
    FinishedRunningJobs = "finishedRunningJobs",
}

export class AccountXViewModel extends BaseViewModel {
    public progress: XProgress | null = null;
    private jobs: XJob[] = [];
    private isFirstRun: boolean = false;

    private tweetIDs: string[] = [];
    private currentTweet: XTweet | null = null;

    async init() {
        this.state = State.Login;
        this.progress = null;
        super.init();
    }

    log(func: string, message: string) {
        console.log(`AccountXViewModel.${func} (${this.state}): ${message}`);
    }

    async setAction(action: string) {
        this.action = action;
        switch (action) {
            case "archive":
                if (this.account.xAccount?.archiveTweets && this.account.xAccount?.archiveDirectMessages) {
                    this.actionString = "I'm archiving your tweets and direct messages.";
                } else {
                    if (this.account.xAccount?.archiveDirectMessages) {
                        this.actionString = "I'm archiving your tweets.";
                    } else {
                        this.actionString = "I'm archiving your direct messages.";
                    }
                }
                break;
            case "delete":
                this.actionString = "I'm deleting your NOT IMPLEMENTED YET.";
                break;
        }
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

    async startArchiving() {
        this.setAction("archive");

        const jobTypes = [];
        jobTypes.push("index");
        if (this.account.xAccount?.archiveTweets) {
            jobTypes.push("archiveTweets");
        }
        if (this.account.xAccount?.archiveDirectMessages) {
            jobTypes.push("archiveDirectMessages");
        }

        this.jobs = await window.electron.X.createJobs(this.account.id, jobTypes);
        this.state = State.RunJobs;
    }

    async startDeleting() {
        // TODO: implement
        console.log("startDeleting: NOT IMPLEMENTED");
    }

    rateLimitSecondsLeft() {
        if (this.progress && this.progress.rateLimitReset) {
            return this.progress.rateLimitReset - Math.floor(Date.now() / 1000);
        }
        return 0;
    }

    async handleRateLimit() {
        console.log("rate limited", this.progress);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.scrollToBottom();

        // Wait until the rate limit is done
        await new Promise(resolve => setTimeout(resolve, this.rateLimitSecondsLeft() * 1000));

        // Click retry.
        /*
        There are two conditions where rate limit occurs for index: if there are no tweets in the DOM's timeline yet, or if there are already some.

        If there are no tweets, the HTML looks kind of like this:
        
        <div>
            <nav aria-label="Profile timelines">
            <div>
                <div>...</div>
                <button>...</button>
            </div>
        </div>

        If there are tweets, the HTML looks like of like this:

        <div>
            <div data-testid="cellInnerDiv"></div>
            <div data-testid="cellInnerDiv"></div>
            <div data-testid="cellInnerDiv>...</div>
                <div>...</div>
                <button>...</button>
            </div>
        </div>
        */
        const code = `
        (() => {
            let el = document.querySelectorAll('[data-testid="cellInnerDiv"]');
            if(el.length === 0) {
                // no tweets have loaded yet
                el = document.querySelector('[aria-label="Profile timelines"]');
                if(el === null) { return false; }
                el = el.parentNode.children[el.parentNode.children.length - 1];
                if(el === null) { return false; }
                el = el.querySelector('button');
                if(el === null) { return false; }
                el.click();
            } else {
                // tweets have loaded
                el = els[els.length - 1];
                if(el === null) { return false; }
                let el = el.querySelector('button');
                if(el === null) { return false; }
                el.click();
            }
            return true;
        })()
        `;
        await this.getWebview()?.executeJavaScript(code);
    }

    async runJob(indexJob: number) {
        // Start the job
        this.jobs[indexJob].startedAt = new Date();
        this.jobs[indexJob].status = "running";
        await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[indexJob]));

        switch (this.jobs[indexJob].jobType) {
            case "index":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}** To start, I need to index your tweets. Hang on while I scroll down to your earliest tweets that I've seen.
`;

                // Check if this is the first time indexing has happened in this account
                if (await window.electron.X.getLastFinishedJob(this.account.id, "index") == null) {
                    this.isFirstRun = true;
                }

                // Start monitoring network requests
                await window.electron.X.indexStart(this.account.id);

                // Load the timeline and wait for tweets to appear
                await this.loadURL("https://x.com/" + this.account.xAccount?.username + "/with_replies");
                try {
                    await this.waitForSelector('article');
                } catch (e) {
                    // Run indexParse so we can see if we were rate limited
                    this.progress = await window.electron.X.indexParse(this.account.id, this.isFirstRun);
                    this.jobs[indexJob].progressJSON = JSON.stringify(this.progress);
                    await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[indexJob]));
                    console.log("progress", this.progress);

                    if (this.progress.isRateLimited) {
                        await this.handleRateLimit();
                    }
                }

                while (this.progress === null || this.progress.isIndexFinished === false) {
                    // Scroll to bottom
                    const moreToScroll = await this.scrollToBottom();

                    // Parse so far
                    this.progress = await window.electron.X.indexParse(this.account.id, this.isFirstRun);
                    this.jobs[indexJob].progressJSON = JSON.stringify(this.progress);
                    await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[indexJob]));
                    console.log("progress", this.progress);

                    // Check if we're done
                    if (!this.progress?.isRateLimited && !moreToScroll) {
                        this.progress = await window.electron.X.indexFinished(this.account.id);
                        break;
                    }

                    // Rate limited?
                    if (this.progress.isRateLimited) {
                        await this.handleRateLimit();
                    }
                }

                // Stop monitoring network requests
                await window.electron.X.indexStop(this.account.id);

                // Job finished
                this.jobs[indexJob].finishedAt = new Date();
                this.jobs[indexJob].status = "finished";
                this.jobs[indexJob].progressJSON = JSON.stringify(this.progress);
                await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[indexJob]));
                console.log("index job finished", this.progress);

                break;

            case "archiveTweets":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}** I'm saving archives of your tweets, one at a time, starting at the oldest. Each tweet takes a few seconds to save. This may take a while.
`;

                // Start with a blank page
                await this.loadURL("about:blank");

                // Get tweet IDs
                this.tweetIDs = await window.electron.X.archiveGetTweetIDs(this.account.id);
                if (this.progress) {
                    this.progress.currentJob = "archiveTweets";
                    this.progress.totalTweetsToArchive = this.tweetIDs.length;
                    this.progress.tweetsArchived = 0;
                }

                // Save cookies to file
                await window.electron.archive.saveCookiesFile(this.account.id);

                // Start archiving
                for (let i = 0; i < this.tweetIDs.length; i++) {
                    this.currentTweet = await window.electron.X.archiveGetTweet(this.account.id, this.tweetIDs[i]);
                    if (this.currentTweet !== null) {
                        const url = `https://x.com/${this.currentTweet.path}`;
                        const filename = await window.electron.archive.savePage(this.account.id, url, this.currentTweet.createdAt, this.currentTweet.tweetId);
                        console.log("saved", filename);

                        // Show the saved file
                        await this.loadURL("file://" + filename);

                        // Update progress
                        if (this.progress) {
                            this.progress.tweetsArchived = i + 1;
                        }
                    }
                }

                // Delete cookies file
                await window.electron.archive.deleteCookiesFile(this.account.id);

                break;

            case "archiveDirectMessages":
                console.log("archiveDirectMessages: NOT IMPLEMENTED");
                break;

            case "deleteTweets":
                console.log("deleteTweets: NOT IMPLEMENTED");
                break;

            case "deleteLikes":
                console.log("deleteLikes: NOT IMPLEMENTED");
                break;

            case "deleteDirectMessages":
                console.log("deleteDirectMessages: NOT IMPLEMENTED");
                break;
        }
    }

    async run() {
        this.log("run", "running");
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

            case State.RunJobs:
                for (let i = 0; i < this.jobs.length; i++) {
                    await this.runJob(i);
                }
                break;
        }
    }
}