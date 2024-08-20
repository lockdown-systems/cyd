import { BaseViewModel } from './BaseViewModel';
import { logObj } from '../helpers';
import type { XJob, XProgress, XArchiveStartResponse, XIndexDMsStartResponse, XRateLimitInfo } from '../../../shared_types';

export enum State {
    Login = "login",
    Dashboard = "dashboard",
    DashboardDisplay = "dashboardDisplay",
    RunJobs = "runJobs",
    FinishedRunningJobs = "finishedRunningJobs",
}

export class AccountXViewModel extends BaseViewModel {
    public progress: XProgress | null = null;
    public rateLimitInfo: XRateLimitInfo | null = null;
    public jobs: XJob[] = [];
    public forceIndexEverything: boolean = false;
    private isFirstRun: boolean = false;

    private archiveStartResponse: XArchiveStartResponse | null = null;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log(func: string, message?: any) {
        if (message === undefined) {
            console.log(`AccountXViewModel.${func} (${this.state}):`);
        } else {
            console.log(`AccountXViewModel.${func} (${this.state}):`, logObj(message));
        }
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
        this.archiveStartResponse = null;
        this.state = State.Dashboard;
    }

    async waitForRateLimit() {
        this.log("waitForRateLimit", this.rateLimitInfo);
        let seconds = 0;
        if (this.rateLimitInfo && this.rateLimitInfo.rateLimitReset) {
            seconds = this.rateLimitInfo.rateLimitReset - Math.floor(Date.now() / 1000);
        }
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    async loadURLWithRateLimit(url: string) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Reset the rate limit checker
            await window.electron.X.resetRateLimitInfo(this.account.id);

            // Load the URL
            await this.loadURL(url);
            await new Promise(resolve => setTimeout(resolve, 3000));
            await this.waitForLoadingToFinish();

            // Were we rate limited?
            this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
            if (this.rateLimitInfo.isRateLimited) {
                await this.waitForRateLimit();
            } else {
                break;
            }
        }
    }

    async indexTweetsHandleRateLimit(): Promise<boolean> {
        this.log("indexTweetsHandleRateLimit", this.progress);
        this.pause();

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
            let els = document.querySelectorAll('[data-testid="cellInnerDiv"]');
            if(els.length === 0) {
                // no tweets have loaded yet
                let el = document.querySelector('[aria-label="Profile timelines"]');
                if(el === null) { return false; }
                el = el.parentNode.children[el.parentNode.children.length - 1];
                if(el === null) { return false; }
                el = el.querySelector('button');
                if(el === null) { return false; }
                el.click();
            } else {
                // tweets have loaded
                let el = els[els.length - 1];
                if(el === null) { return false; }
                el = el.querySelector('button');
                if(el === null) { return false; }
                el.click();
            }
            return true;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    async indexDMConversationsHandleRateLimit(): Promise<boolean> {
        this.log("indexDMConversationsHandleRateLimit", this.progress);
        this.pause();

        const code = `
        (() => {
            let els = document.querySelectorAll('[data-testid="cellInnerDiv"]');
            if(els.length === 0) {
                // no tweets have loaded yet
                let el = document.querySelector('[aria-label="Profile timelines"]');
                if(el === null) { return false; }
                el = el.parentNode.children[el.parentNode.children.length - 1];
                if(el === null) { return false; }
                el = el.querySelector('button');
                if(el === null) { return false; }
                el.click();
            } else {
                // tweets have loaded
                let el = els[els.length - 1];
                if(el === null) { return false; }
                el = el.querySelector('button');
                if(el === null) { return false; }
                el.click();
            }
            return true;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    async indexDMsHandleRateLimit(): Promise<boolean> {
        this.log("indexDMsHandleRateLimit", this.progress);
        this.pause();

        const code = `
        (() => {
            let els = document.querySelectorAll('[data-testid="cellInnerDiv"]');
            if(els.length === 0) {
                // no tweets have loaded yet
                let el = document.querySelector('[aria-label="Profile timelines"]');
                if(el === null) { return false; }
                el = el.parentNode.children[el.parentNode.children.length - 1];
                if(el === null) { return false; }
                el = el.querySelector('button');
                if(el === null) { return false; }
                el.click();
            } else {
                // tweets have loaded
                let el = els[els.length - 1];
                if(el === null) { return false; }
                el = el.querySelector('button');
                if(el === null) { return false; }
                el.click();
            }
            return true;
        })()
        `;
        return await this.getWebview()?.executeJavaScript(code);
    }

    async login() {
        const originalUsername = this.account && this.account.xAccount && this.account.xAccount.username ? this.account.xAccount.username : null;

        this.showBrowser = true;
        await this.loadURLWithRateLimit("https://x.com/login");
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
            this.log("runJob", "failed to get username");
            return;
        }

        if (originalUsername !== null && username != originalUsername) {
            this.log(`Username changed from ${this.account.xAccount?.username} to ${username}`);
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
        this.log("finishJob", this.jobs[iJob].jobType);
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
                if (this.forceIndexEverything || await window.electron.X.getLastFinishedJob(this.account.id, "indexTweets") == null) {
                    this.isFirstRun = true;
                }

                // Start monitoring network requests
                await window.electron.X.indexStart(this.account.id);

                // Load the timeline and wait for tweets to appear
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    await this.loadURLWithRateLimit("https://x.com/" + this.account.xAccount?.username + "/with_replies");
                    try {
                        await window.electron.X.resetRateLimitInfo(this.account.id);
                        await this.waitForSelector('article');
                        break;
                    } catch (e) {
                        this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                        if (this.rateLimitInfo.isRateLimited) {
                            await this.waitForRateLimit();
                        }
                    }
                }

                while (this.progress === null || this.progress.isIndexTweetsFinished === false) {
                    // Scroll to bottom
                    await window.electron.X.resetRateLimitInfo(this.account.id);
                    let moreToScroll = await this.scrollToBottom();
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await this.scrollToBottom();
                        await this.waitForRateLimit();
                        if (!await this.indexTweetsHandleRateLimit()) {
                            // TODO: Automation error
                        }
                        moreToScroll = true;
                    }

                    // Parse so far
                    this.progress = await window.electron.X.indexParseTweets(this.account.id, this.isFirstRun);
                    this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                    await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));

                    // Check if we're done
                    if (!moreToScroll) {
                        this.progress = await window.electron.X.indexTweetsFinished(this.account.id);
                        break;
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
                this.archiveStartResponse = await window.electron.X.archiveTweetsStart(this.account.id);
                this.log('archiveStartResponse', this.archiveStartResponse);

                if (this.progress && this.archiveStartResponse && this.webContentsID) {

                    // Start the progress
                    this.progress.currentJob = "archiveTweets";
                    this.progress.totalTweetsToArchive = this.archiveStartResponse.items.length;
                    this.progress.tweetsArchived = 0;

                    // Archive the tweets
                    for (let i = 0; i < this.archiveStartResponse.items.length; i++) {
                        await this.waitForPause();

                        // Already saved?
                        if (await window.electron.archive.isPageAlreadySaved(this.archiveStartResponse.outputPath, this.archiveStartResponse.items[i].basename)) {
                            this.progress.tweetsArchived += 1;
                            continue;
                        }

                        // Load the URL
                        await this.loadURLWithRateLimit(this.archiveStartResponse.items[i].url);

                        // Save the page
                        await window.electron.archive.savePage(this.webContentsID, this.archiveStartResponse.outputPath, this.archiveStartResponse.items[i].basename);

                        // Update tweet's archivedAt date
                        await window.electron.X.archiveTweet(this.account.id, this.archiveStartResponse.items[i].basename);

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
                if (this.forceIndexEverything || await window.electron.X.getLastFinishedJob(this.account.id, "indexDMs") == null) {
                    this.isFirstRun = true;
                }

                // Start monitoring network requests
                await window.electron.X.indexStart(this.account.id);

                // Load the messages and wait for tweets to appear
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    await this.loadURLWithRateLimit("https://x.com/messages");
                    try {
                        await window.electron.X.resetRateLimitInfo(this.account.id);
                        await this.waitForSelector('div[aria-label="Timeline: Messages"]');
                        break;
                    } catch (e) {
                        this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                        if (this.rateLimitInfo.isRateLimited) {
                            await this.waitForRateLimit();
                            break;
                        }
                    }
                }


                while (this.progress === null || this.progress.isIndexDMConversationsFinished === false) {
                    // Scroll to bottom
                    await window.electron.X.resetRateLimitInfo(this.account.id);
                    let moreToScroll = await this.scrollToBottom();
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                        if (!await this.indexDMConversationsHandleRateLimit()) {
                            // TODO: Automation error
                        }
                        moreToScroll = true;
                    }

                    // Parse so far
                    this.progress = await window.electron.X.indexParseDMConversations(this.account.id, this.isFirstRun);
                    this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                    await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));
                    this.log("progress", this.progress);

                    // Check if we're done
                    if (!moreToScroll) {
                        this.progress = await window.electron.X.indexDMConversationsFinished(this.account.id);
                        break;
                    }
                }

                // Index the conversation messages
                this.instructions = `
**${this.actionString}**

Now I'm indexing the messages in each conversation.
`;
                this.indexDMsStartResponse = await window.electron.X.indexDMsStart(this.account.id, this.isFirstRun);
                this.log('indexDMsStartResponse', this.indexDMsStartResponse);

                if (this.indexDMsStartResponse) {
                    for (let i = 0; i < this.indexDMsStartResponse.conversationIDs.length; i++) {
                        // Load the URL
                        await this.loadURLWithRateLimit("https://x.com/messages/" + this.indexDMsStartResponse.conversationIDs[i]);
                        await this.waitForSelector('div[data-testid="DmActivityContainer"]');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await this.waitForLoadingToFinish();

                        while (this.progress === null || this.progress.isIndexDMsFinished === false) {
                            // Scroll to top
                            await window.electron.X.resetRateLimitInfo(this.account.id);
                            let moreToScroll = await this.scrollToTop('div[data-testid="DmActivityViewport"]');
                            this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                            if (this.rateLimitInfo.isRateLimited) {
                                await this.waitForRateLimit();
                                if (!await this.indexDMsHandleRateLimit()) {
                                    // TODO: Automation error
                                }
                                moreToScroll = true;
                            }

                            // Parse so far
                            this.progress = await window.electron.X.indexParseDMs(this.account.id);
                            this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                            await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));

                            // Check if we're done
                            if (!moreToScroll) {
                                break;
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
                this.log("deleteTweets: NOT IMPLEMENTED");
                await this.finishJob(iJob);
                break;

            case "deleteLikes":
                this.log("deleteLikes: NOT IMPLEMENTED");
                await this.finishJob(iJob);
                break;

            case "deleteDMs":
                this.log("deleteDMs: NOT IMPLEMENTED");
                await this.finishJob(iJob);
                break;
        }
    }

    async run() {
        this.log("run", "running");
        this.progress = await window.electron.X.resetProgress(this.account.id);

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
                    this.instructions += `I have **archived ${this.progress?.tweetsArchived.toLocaleString()} tweets**.`
                } else if (this.account.xAccount?.archiveTweets && this.account.xAccount?.archiveDMs) {
                    this.instructions += `I have **archived ${this.progress?.tweetsArchived.toLocaleString()} tweets** and **indexed ${this.progress?.dmConversationsIndexed} direct message conversations**.`
                } else if (!this.account.xAccount?.archiveTweets && this.account.xAccount?.archiveDMs) {
                    this.instructions += `I have **indexed ${this.progress?.dmConversationsIndexed} direct message conversations**.`
                }
                break;
        }
    }
}