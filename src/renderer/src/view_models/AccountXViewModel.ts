import { BaseViewModel } from './BaseViewModel';
import type { XJob, XProgress, XArchiveTweetsStartResponse, XIndexDMsStartResponse } from '../../../shared_types';

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
    private indexDMsStartResponse: XIndexDMsStartResponse | null = null;

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
                if (this.account.xAccount?.archiveTweets && this.account.xAccount?.archiveDMs) {
                    this.actionString = "I'm archiving your tweets and direct messages.";
                    this.actionFinishedString = "I've finished archiving your tweets and direct messages!";
                } else {
                    if (this.account.xAccount?.archiveDMs) {
                        this.actionString = "I'm archiving your direct messages.";
                        this.actionFinishedString = "I've finished archiving your direct messages!";
                    } else {
                        this.actionString = "I'm archiving your tweets.";
                        this.actionFinishedString = "I've finished archiving your tweets!";
                    }
                }
                break;
            case "delete":
                this.actionString = "I'm deleting your NOT IMPLEMENTED YET.";
                this.actionFinishedString = "I've finished deleting your NOT IMPLEMENTED YET!";
                break;
        }
    }

    async startArchiving() {
        this.setAction("archive");

        const jobTypes = [];
        jobTypes.push("login");
        if (this.account.xAccount?.archiveTweets) {
            jobTypes.push("indexTweets");
            jobTypes.push("archiveTweets");
        }
        if (this.account.xAccount?.archiveDMs) {
            jobTypes.push("indexDMs");
            jobTypes.push("archiveDMs");
        }
        jobTypes.push("archiveBuild");

        this.jobs = await window.electron.X.createJobs(this.account.id, jobTypes);
        this.state = State.RunJobs;
    }

    async startDeleting() {
        // TODO: implement
        console.log("startDeleting: NOT IMPLEMENTED");
    }

    async reset() {
        this.progress = null;
        this.jobs = [];
        this.isFirstRun = false;
        this.archiveTweetsStartResponse = null;
        this.state = State.Dashboard;
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

        await this.waitForPause();

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

    async finishJob(iJob: number) {
        this.jobs[iJob].finishedAt = new Date();
        this.jobs[iJob].status = "finished";
        this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
        await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));
        this.log("finishJob", `${this.jobs[iJob].jobType}: ${this.progress}`);
    }

    async runJob(iJob: number) {
        await this.waitForPause();

        // Start the job
        this.jobs[iJob].startedAt = new Date();
        this.jobs[iJob].status = "running";
        await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));

        switch (this.jobs[iJob].jobType) {
            case "login":
                this.instructions = `
**${this.actionString}**

Checking to see if you're still logged in to your X account...
`;
                await this.login();
                await this.finishJob(iJob);
                break;

            case "indexTweets":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

Hang on while I scroll down to your earliest tweets that I've seen.
`;

                // Check if this is the first time indexing tweets has happened in this account
                if (await window.electron.X.getLastFinishedJob(this.account.id, "indexTweets") == null) {
                    this.isFirstRun = true;
                }

                // Start monitoring network requests
                await window.electron.X.indexStart(this.account.id);

                // Load the timeline and wait for tweets to appear
                await this.loadURL("https://x.com/" + this.account.xAccount?.username + "/with_replies");
                try {
                    await this.waitForSelector('article');
                } catch (e) {
                    // Run indexParseTweets so we can see if we were rate limited
                    this.progress = await window.electron.X.indexParseTweets(this.account.id, this.isFirstRun);
                    this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                    await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));
                    console.log("progress", this.progress);

                    if (this.progress.isRateLimited) {
                        await this.handleRateLimit();
                    }
                }

                while (this.progress === null || this.progress.isIndexTweetsFinished === false) {
                    // Scroll to bottom
                    const moreToScroll = await this.scrollToBottom();

                    // Parse so far
                    this.progress = await window.electron.X.indexParseTweets(this.account.id, this.isFirstRun);
                    this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                    await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));
                    console.log("progress", this.progress);

                    // Check if we're done
                    if (!this.progress?.isRateLimited && !moreToScroll) {
                        this.progress = await window.electron.X.indexTweetsFinished(this.account.id);
                        break;
                    }

                    // Rate limited?
                    if (this.progress.isRateLimited) {
                        await this.handleRateLimit();
                    }
                }

                // Stop monitoring network requests
                await window.electron.X.indexStop(this.account.id);

                await this.finishJob(iJob);
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

                        // Update tweet's archivedAt date
                        await window.electron.X.archiveTweet(this.account.id, this.archiveTweetsStartResponse.tweets[i].basename);

                        // Update progress
                        this.progress.tweetsArchived += 1;
                    }
                }

                await this.finishJob(iJob);
                break;

            case "indexDMs":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

Hang on while I scroll down to your earliest direct message conversations that I've seen.
`;

                // Check if this is the first time indexing DMs has happened in this account
                if (await window.electron.X.getLastFinishedJob(this.account.id, "indexDMs") == null) {
                    this.isFirstRun = true;
                }

                // Start monitoring network requests
                await window.electron.X.indexStart(this.account.id);

                for (const url of ["https://x.com/messages", "https://x.com/messages/requests"]) {
                    // Load the messages and wait for tweets to appear
                    await this.loadURL(url);
                    try {
                        await this.waitForSelector('div[aria-label="Timeline: Messages"]');
                    } catch (e) {
                        // Run indexParseDMConversations so we can see if we were rate limited
                        this.progress = await window.electron.X.indexParseDMConversations(this.account.id, this.isFirstRun);
                        this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                        await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));
                        console.log("progress", this.progress);

                        if (this.progress.isRateLimited) {
                            await this.handleRateLimit();
                        }
                    }

                    while (this.progress === null || this.progress.isIndexDMConversationsFinished === false) {
                        // Scroll to bottom
                        const moreToScroll = await this.scrollToBottom();

                        // Parse so far
                        this.progress = await window.electron.X.indexParseDMConversations(this.account.id, this.isFirstRun);
                        this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                        await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));
                        console.log("progress", this.progress);

                        // Check if we're done
                        if (!this.progress?.isRateLimited && !moreToScroll) {
                            this.progress = await window.electron.X.indexDMsFinished(this.account.id);
                            break;
                        }

                        // Rate limited?
                        if (this.progress.isRateLimited) {
                            await this.handleRateLimit();
                        }
                    }
                }

                // Index the conversation messages
                this.instructions = `
**${this.actionString}**

Now I'm indexing the messages in each conversation.
`;
                this.indexDMsStartResponse = await window.electron.X.indexDMsStart(this.account.id);
                console.log('indexDMsStartResponse', this.indexDMsStartResponse);

                if (this.indexDMsStartResponse) {
                    for (let i = 0; i < this.indexDMsStartResponse.conversationIDs.length; i++) {
                        // Load the URL
                        await this.loadURL("https://x.com/messages/" + this.indexDMsStartResponse.conversationIDs[i]);
                        await this.waitForSelector('div[data-testid="DmActivityContainer"]');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await this.waitForLoadingToFinish();

                        while (this.progress === null || this.progress.isIndexDMsFinished === false) {
                            // Scroll to top
                            const moreToScroll = await this.scrollToTop();

                            // Parse so far
                            this.progress = await window.electron.X.indexParseDMs(this.account.id);
                            this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                            await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));
                            console.log("progress", this.progress);

                            // Check if we're done
                            if (!this.progress?.isRateLimited && !moreToScroll) {
                                break;
                            }

                            // Rate limited?
                            if (this.progress.isRateLimited) {
                                await this.handleRateLimit();
                            }
                        }

                        // Mark the conversation's shouldIndexMessages to false
                        await window.electron.X.indexDMConversationFinished(this.account.id, this.indexDMsStartResponse.conversationIDs[i]);
                    }
                }

                // Stop monitoring network requests
                await window.electron.X.indexStop(this.account.id);

                await this.finishJob(iJob);
                break;

            case "archiveDMs":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

I'm archiving your direct messages, starting with the oldest. This may take a while...
`;

                // TODO: implement

                await this.finishJob(iJob);
                break;

            case "archiveBuild":
                this.showBrowser = false;
                this.instructions = `
**${this.actionString}**

I'm building a searchable archive web page in HTML.
`;

                // Build the archive
                await window.electron.X.archiveBuild(this.account.id);

                await this.finishJob(iJob);
                break;

            case "deleteTweets":
                console.log("deleteTweets: NOT IMPLEMENTED");
                await this.finishJob(iJob);
                break;

            case "deleteLikes":
                console.log("deleteLikes: NOT IMPLEMENTED");
                await this.finishJob(iJob);
                break;

            case "deleteDMs":
                console.log("deleteDMs: NOT IMPLEMENTED");
                await this.finishJob(iJob);
                break;
        }
    }

    async run() {
        this.log("run", "running");
        this.progress = await window.electron.X.resetProgress(this.account.id);
        await this.waitForWebviewReady();

        switch (this.state) {
            case State.Login:
                this.instructions = `
Semiphemeral can help you archive your tweets and directs messages, and delete your tweets, 
retweets, likes, and direct messages. **To get started, log in to your X account below.**
`;
                await this.login();
                this.state = State.Dashboard;
                break;

            case State.Dashboard:
                this.showBrowser = false;
                await this.loadURL("about:blank");
                this.instructions = `
You're signed into **@${this.account.xAccount?.username}** on X. What would you like to do?
`;
                this.state = State.DashboardDisplay;
                break;

            case State.RunJobs:
                for (let i = 0; i < this.jobs.length; i++) {
                    await this.runJob(i);
                }

                this.state = State.FinishedRunningJobs;
                this.showBrowser = false;
                await this.loadURL("about:blank");
                this.instructions = `
**${this.actionFinishedString}**

`;
                if (this.account.xAccount?.archiveTweets && !this.account.xAccount?.archiveDMs) {
                    this.instructions += `I have archived **${this.progress?.tweetsArchived.toLocaleString()} tweets**.`
                } else if (this.account.xAccount?.archiveTweets && this.account.xAccount?.archiveDMs) {
                    this.instructions += `I have archived **${this.progress?.tweetsArchived.toLocaleString()} tweets** and **${this.progress?.dmConversationsArchived} direct message conversations**.`
                } else if (!this.account.xAccount?.archiveTweets && this.account.xAccount?.archiveDMs) {
                    this.instructions += `I have archived **${this.progress?.dmConversationsArchived} direct message conversations**.`
                }
                break;
        }
    }
}