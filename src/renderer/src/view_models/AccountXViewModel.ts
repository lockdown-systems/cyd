import { BaseViewModel } from './BaseViewModel';
import type { XJob, XProgress, XArchiveTweetsStartResponse } from '../../../shared_types';

export enum State {
    Login = "login",
    Dashboard = "dashboard",
    DashboardDisplay = "dashboardDisplay",
    RunJobs = "runJobs",
    FinishedRunningJobs = "finishedRunningJobs",
}

export class AccountXViewModel extends BaseViewModel {
    public progress: XProgress | null = null;
    public jobs: XJob[] = [];
    private isFirstRun: boolean = false;

    private archiveTweetsStartResponse: XArchiveTweetsStartResponse | null = null;

    async init() {
        if (this.account && this.account.xAccount && this.account.xAccount.username) {
            this.state = State.Dashboard;
        } else {
            this.state = State.Login;
        }

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
                        this.actionString = "I'm archiving your direct messages.";
                    } else {
                        this.actionString = "I'm archiving your tweets.";
                    }
                }
                break;
            case "delete":
                this.actionString = "I'm deleting your NOT IMPLEMENTED YET.";
                break;
        }
    }

    async startArchiving() {
        this.setAction("archive");

        const jobTypes = [];
        jobTypes.push("login");
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

    async login() {
        const originalUsername = this.account && this.account.xAccount && this.account.xAccount.username ? this.account.xAccount.username : null;

        this.showBrowser = true;
        await this.loadURL("https://x.com/login");
        await this.waitForURL("https://x.com/home");

        // We're logged in
        this.log("runJob", "login succeeded");

        // Get the username
        let username = null;
        if (this.webContentsID) {
            username = await window.electron.X.getUsername(this.account.id, this.webContentsID);
        }
        if (!username) {
            // TODO: Automation error
            this.log("runJob", "failed to get username, waiting 10s");
            await new Promise(resolve => setTimeout(resolve, 10000));
            return;
        }

        if (originalUsername !== null && username != originalUsername) {
            console.log(`Username changed from ${this.account.xAccount?.username} to ${username}`);
            // TODO: username changed error
            return;
        }

        // Save it
        if (this.account && this.account.xAccount) {
            this.account.xAccount.username = username;
        }
        await window.electron.database.saveAccount(JSON.stringify(this.account));
    }

    async runJob(indexJob: number) {
        // Start the job
        this.jobs[indexJob].startedAt = new Date();
        this.jobs[indexJob].status = "running";
        await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[indexJob]));

        switch (this.jobs[indexJob].jobType) {
            case "login":
                this.instructions = `
**${this.actionString}**

Checking to see if you're still logged in to your X account...
`;
                await this.login();

                // Job finished
                this.jobs[indexJob].finishedAt = new Date();
                this.jobs[indexJob].status = "finished";
                await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[indexJob]));
                this.log("runJob", "login job finished");

                break;

            case "index":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

To start, I need to index your tweets. Hang on while I scroll down to your earliest tweets that I've seen.
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
                this.log("runJob", `index job finished: ${this.progress}`);

                break;

            case "archiveTweets":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

I'm archiving your tweets, starting with the oldest. This may take a while...
`;

                // Initialize archiving of tweets
                this.archiveTweetsStartResponse = await window.electron.X.archiveTweetsStart(this.account.id);
                console.log('archiveTweetsStartResponse', this.archiveTweetsStartResponse);

                if (this.progress && this.archiveTweetsStartResponse && this.webContentsID) {

                    // Start the progress
                    this.progress.currentJob = "archiveTweets";
                    this.progress.totalTweetsToArchive = this.archiveTweetsStartResponse.tweets.length;
                    this.progress.tweetsArchived = 0;

                    // Archive the tweets
                    for (let i = 0; i < this.archiveTweetsStartResponse.tweets.length; i++) {
                        // Already saved?
                        if (await window.electron.archive.isPageAlreadySaved(this.archiveTweetsStartResponse.outputPath, this.archiveTweetsStartResponse.tweets[i].basename)) {
                            this.progress.tweetsArchived += 1;
                            continue;
                        }

                        // Load the URL
                        await this.loadURL(this.archiveTweetsStartResponse.tweets[i].url);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        await this.waitForLoadingToFinish();

                        // Save the page
                        await window.electron.archive.savePage(this.webContentsID, this.archiveTweetsStartResponse.outputPath, this.archiveTweetsStartResponse.tweets[i].basename);

                        // Update progress
                        this.progress.tweetsArchived += 1;
                    }
                }

                // Job finished
                this.jobs[indexJob].finishedAt = new Date();
                this.jobs[indexJob].status = "finished";
                this.jobs[indexJob].progressJSON = JSON.stringify(this.progress);
                await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[indexJob]));
                this.log("runJob", `archiveTweets job finished: ${this.progress}`);

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
                this.instructions = `
Semiphemeral can help you archive your tweets and directs messages, and delete your tweets, retweets, likes, and direct messages. To get started, log in to your X account below.
`;
                await this.login();
                this.state = State.Dashboard;
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