import { BaseViewModel } from './BaseViewModel';
import { logObj } from '../helpers';
import {
    XJob,
    XProgress, emptyXProgress,
    XArchiveStartResponse, emptyXArchiveStartResponse,
    XIndexMessagesStartResponse, emptyXIndexMessagesStartResponse,
    XRateLimitInfo, emptyXRateLimitInfo,
    XProgressInfo, emptyXProgressInfo
} from '../../../shared_types';
import { PlausibleEvents, ApiErrorResponse } from "../types";

export enum State {
    Login = "login",
    Dashboard = "dashboard",
    DashboardDisplay = "dashboardDisplay",
    RunJobs = "runJobs",
    FinishedRunningJobs = "finishedRunningJobs",
}

export class AccountXViewModel extends BaseViewModel {
    public progress: XProgress = emptyXProgress();
    public rateLimitInfo: XRateLimitInfo = emptyXRateLimitInfo();
    public progressInfo: XProgressInfo = emptyXProgressInfo();
    public postXProgresResp: boolean | ApiErrorResponse = false;
    public jobs: XJob[] = [];
    public forceIndexEverything: boolean = false;
    private isFirstRun: boolean = false;

    private archiveStartResponse: XArchiveStartResponse = emptyXArchiveStartResponse();
    private indexMessagesStartResponse: XIndexMessagesStartResponse = emptyXIndexMessagesStartResponse();

    async init() {
        if (this.account && this.account.xAccount && this.account.xAccount.username) {
            this.state = State.Dashboard;
        } else {
            this.state = State.Login;
        }

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
            jobTypes.push("indexConversations");
            jobTypes.push("indexMessages");
        }
        jobTypes.push("archiveBuild");

        this.jobs = await window.electron.X.createJobs(this.account.id, jobTypes);
        this.state = State.RunJobs;

        await window.electron.trackEvent(PlausibleEvents.X_ARCHIVE_STARTED, navigator.userAgent);
    }

    async startDeleting() {
        // TODO: implement
        console.log("startDeleting: NOT IMPLEMENTED");
        await window.electron.showMessage("Deleting data from X is not implemented yet.");

        await window.electron.trackEvent(PlausibleEvents.X_DELETE_STARTED, navigator.userAgent);
    }

    async reset() {
        this.progress = emptyXProgress();
        this.rateLimitInfo = emptyXRateLimitInfo();
        this.jobs = [];
        this.isFirstRun = false;
        this.archiveStartResponse = emptyXArchiveStartResponse();
        this.state = State.Dashboard;
    }

    async waitForRateLimit() {
        this.log("waitForRateLimit", this.rateLimitInfo);
        let seconds = 0;
        if (this.rateLimitInfo.rateLimitReset) {
            seconds = this.rateLimitInfo.rateLimitReset - Math.floor(Date.now() / 1000);
        }
        await this.sleep(seconds * 1000);
    }

    async loadURLWithRateLimit(url: string) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Reset the rate limit checker
            await window.electron.X.resetRateLimitInfo(this.account.id);

            // Load the URL
            await this.loadURL(url);
            await this.sleep(3000);
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

    async syncProgress() {
        await window.electron.X.syncProgress(this.account.id, JSON.stringify(this.progress));
    }

    async indexTweetsHandleRateLimit(): Promise<boolean> {
        this.log("indexTweetsHandleRateLimit", this.progress);

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

    async login() {
        const originalUsername = this.account && this.account.xAccount && this.account.xAccount.username ? this.account.xAccount.username : null;

        this.showBrowser = true;

        this.log("login", "logging in");
        await this.loadURLWithRateLimit("https://x.com/login");
        await this.waitForURL("https://x.com/home");

        // We're logged in
        this.log("login", "login succeeded");
        this.showAutomationNotice = true;

        // If this is the first time we're logging in, track it
        if (this.state === State.Login) {
            await window.electron.trackEvent(PlausibleEvents.X_USER_SIGNED_IN, navigator.userAgent);
        }

        await this.waitForPause();

        // Get the username
        this.log("login", "getting username");
        this.instructions = `You've logged in successfully. Now I'm scraping your username...`;

        let username = null;
        if (this.webContentsID) {
            username = await window.electron.X.getUsername(this.account.id, this.webContentsID);
        }
        if (!username) {
            // TODO: Automation error
            this.log("login", "failed to get username");
            return;
        }

        if (originalUsername !== null && username != originalUsername) {
            this.log("login", `username changed from ${this.account.xAccount?.username} to ${username}`);
            // TODO: username changed error
            return;
        }

        // Save the username
        if (this.account && this.account.xAccount) {
            this.account.xAccount.username = username;
        }
        await window.electron.database.saveAccount(JSON.stringify(this.account));
        this.log("login", "saved username");

        // Get the profile image
        this.log("login", "getting profile image");
        this.instructions = `You're logged in as **@${username}**. Now I'm scraping your profile image...`;

        await this.loadURLWithRateLimit(`https://x.com/${username}/photo`);
        await this.waitForSelector('div[aria-label="Image"]');

        const profileImageURL = await this.getWebview()?.executeJavaScript(`document.querySelector('div[aria-label="Image"]').querySelector('img').src`);
        await window.electron.X.saveProfileImage(this.account.id, profileImageURL);
        this.log("login", `saved profile image: ${profileImageURL}`);
        this.shouldReloadAccounts = true;

        await this.waitForPause();
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

        // Set the current job immediately
        this.progress.currentJob = this.jobs[iJob].jobType;
        await this.syncProgress();

        switch (this.jobs[iJob].jobType) {
            case "login":
                this.instructions = `
**${this.actionString}**

Checking to see if you're still logged in to your X account...
`;
                this.showAutomationNotice = true;
                await this.login();
                await this.finishJob(iJob);
                break;

            case "indexTweets":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

Hang on while I scroll down to your earliest tweets that I've seen.
`;
                this.showAutomationNotice = true;

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

                while (this.progress.isIndexTweetsFinished === false) {
                    // Scroll to bottom
                    await window.electron.X.resetRateLimitInfo(this.account.id);
                    let moreToScroll = await this.scrollToBottom();
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.sleep(500);
                        await this.scrollToBottom();
                        await this.waitForRateLimit();
                        if (!await this.indexTweetsHandleRateLimit()) {
                            // TODO: Automation error
                        }
                        await this.sleep(500);
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
                this.showAutomationNotice = true;

                // Initialize archiving of tweets
                this.archiveStartResponse = await window.electron.X.archiveTweetsStart(this.account.id);
                this.log('archiveStartResponse', this.archiveStartResponse);

                if (this.webContentsID) {

                    // Start the progress
                    this.progress.currentJob = "archiveTweets";
                    this.progress.totalTweetsToArchive = this.archiveStartResponse.items.length;
                    this.progress.tweetsArchived = 0;
                    this.progress.newTweetsArchived = 0;

                    // Archive the tweets
                    for (let i = 0; i < this.archiveStartResponse.items.length; i++) {
                        await this.waitForPause();

                        // Already saved?
                        if (await window.electron.archive.isPageAlreadySaved(this.archiveStartResponse.outputPath, this.archiveStartResponse.items[i].basename)) {
                            // Ensure the tweet has an archivedAt date
                            await window.electron.X.archiveTweetCheckDate(this.account.id, this.archiveStartResponse.items[i].id);

                            this.progress.tweetsArchived += 1;
                            continue;
                        }

                        // Load the URL
                        await this.loadURLWithRateLimit(this.archiveStartResponse.items[i].url);

                        // Save the page
                        await window.electron.archive.savePage(this.webContentsID, this.archiveStartResponse.outputPath, this.archiveStartResponse.items[i].basename);

                        // Update tweet's archivedAt date
                        await window.electron.X.archiveTweet(this.account.id, this.archiveStartResponse.items[i].id);

                        // Update progress
                        this.progress.tweetsArchived += 1;
                        this.progress.newTweetsArchived += 1;
                    }
                }

                await this.syncProgress();
                await this.finishJob(iJob);
                break;

            case "indexConversations":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

Hang on while I scroll down to your earliest direct message conversations that I've seen.
`;
                this.showAutomationNotice = true;

                // Check if this is the first time indexing DMs has happened in this account
                if (this.forceIndexEverything || await window.electron.X.getLastFinishedJob(this.account.id, "indexConversations") == null) {
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

                while (this.progress.isIndexConversationsFinished === false) {
                    // Scroll to bottom
                    await window.electron.X.resetRateLimitInfo(this.account.id);
                    const moreToScroll = await this.scrollToBottom();
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                    }

                    // Parse so far
                    this.progress = await window.electron.X.indexParseConversations(this.account.id, this.isFirstRun);
                    this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                    await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));

                    // Check if we're done
                    if (!await window.electron.X.indexIsThereMore(this.account.id)) {
                        this.progress = await window.electron.X.indexConversationsFinished(this.account.id);
                        break;
                    } else {
                        if (!moreToScroll) {
                            // We scrolled to the bottom but we're not finished, so scroll up a bit to trigger infinite scroll next time
                            await this.sleep(500);
                            await this.scrollUp(1000);
                        }
                    }
                }

                // Stop monitoring network requests
                await window.electron.X.indexStop(this.account.id);

                await this.finishJob(iJob);
                break;

            case "indexMessages":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

Please wait while I index all of the messages from each conversation.
`;
                this.showAutomationNotice = true;

                // Only set isFirstRun to true if we're forcing everything to be indexed
                // Because even if idnexMessages has never completed, we want to resume where we left off
                if (this.forceIndexEverything) {
                    this.isFirstRun = true;
                }

                // Start monitoring network requests
                await window.electron.X.indexStart(this.account.id);

                // Load the conversations
                this.indexMessagesStartResponse = await window.electron.X.indexMessagesStart(this.account.id, this.isFirstRun);
                this.progress.currentJob = "indexMessages";
                this.progress.totalConversations = this.indexMessagesStartResponse?.totalConversations;
                this.progress.conversationMessagesIndexed = this.progress.totalConversations - this.indexMessagesStartResponse?.conversationIDs.length;
                await this.syncProgress();
                this.log('indexMessagesStartResponse', this.indexMessagesStartResponse);

                for (let i = 0; i < this.indexMessagesStartResponse.conversationIDs.length; i++) {
                    // Load the URL (in 3 tries)
                    let tries = 0;
                    let shouldSkip = false;
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        await this.loadURLWithRateLimit("https://x.com/messages/" + this.indexMessagesStartResponse.conversationIDs[i]);
                        try {
                            await this.waitForSelector('div[data-testid="DmActivityContainer"]');
                            break;
                        } catch (e) {
                            // Have we been redirected, such as to https://x.com/i/verified-get-verified ?
                            // This is a page that says: "Get X Premium to message this user"
                            if (this.webview && this.webview.getURL() != "https://x.com/messages/" + this.indexMessagesStartResponse.conversationIDs[i]) {
                                this.log("runJob", "Conversation is inaccessible, so skipping it");
                                this.progress.conversationMessagesIndexed += 1;
                                await this.syncProgress();
                                shouldSkip = true;

                                // Mark the conversation's shouldIndexMessages to false
                                await window.electron.X.indexConversationFinished(this.account.id, this.indexMessagesStartResponse.conversationIDs[i]);
                                break;
                            } else {
                                if (tries == 3) {
                                    // TODO: automation error
                                    throw e;
                                }

                                // Try again
                                tries += 1;
                                await this.sleep(500);
                            }
                        }
                    }

                    if (shouldSkip) {
                        continue;
                    }

                    await this.sleep(500);
                    await this.waitForLoadingToFinish();

                    while (this.progress.isIndexMessagesFinished === false) {
                        // Scroll to top
                        await window.electron.X.resetRateLimitInfo(this.account.id);
                        let moreToScroll = await this.scrollToTop('div[data-testid="DmActivityViewport"]');
                        this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                        if (this.rateLimitInfo.isRateLimited) {
                            await this.waitForRateLimit();
                            moreToScroll = true;
                        }

                        // Parse so far
                        this.progress = await window.electron.X.indexParseMessages(this.account.id);
                        this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                        await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));

                        // Check if we're done
                        if (!moreToScroll || this.progress.shouldStopEarly) {
                            if (this.progress.shouldStopEarly) {
                                this.progress.shouldStopEarly = false;
                            }

                            this.progress.conversationMessagesIndexed += 1;
                            await this.syncProgress();
                            break;
                        }
                    }

                    // Mark the conversation's shouldIndexMessages to false
                    await window.electron.X.indexConversationFinished(this.account.id, this.indexMessagesStartResponse.conversationIDs[i]);
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
                this.showAutomationNotice = true;

                // Build the archive
                await window.electron.X.archiveBuild(this.account.id);

                // Archiving complete
                await window.electron.trackEvent(PlausibleEvents.X_ARCHIVE_COMPLETED, navigator.userAgent);

                // Submit progress to the API
                this.progressInfo = await window.electron.X.getProgressInfo(this.account?.id);
                this.log("progressInfo", JSON.parse(JSON.stringify(this.progressInfo)));
                this.postXProgresResp = await this.api.postXProgress({
                    account_uuid: this.progressInfo.accountUUID,
                    total_tweets_archived: this.progressInfo.totalTweetsArchived,
                    total_messages_indexed: this.progressInfo.totalMessagesIndexed,
                    total_tweets_deleted: this.progressInfo.totalTweetsDeleted,
                    total_retweets_deleted: this.progressInfo.totalRetweetsDeleted,
                    total_likes_deleted: this.progressInfo.totalLikesDeleted,
                    total_messages_deleted: this.progressInfo.totalMessagesDeleted
                }, this.deviceInfo?.valid ? true : false)
                if (this.postXProgresResp !== true && this.postXProgresResp !== false && this.postXProgresResp.error) {
                    // Silently log the error and continue
                    this.log("Failed to post progress to the API", this.postXProgresResp.message);
                }

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

            case "deleteMessages":
                this.log("deleteMessages: NOT IMPLEMENTED");
                await this.finishJob(iJob);
                break;
        }
    }

    async run() {
        this.log("run", "running");
        this.progress = await window.electron.X.resetProgress(this.account.id);

        switch (this.state) {
            case State.Login:
                this.actionString = `Semiphemeral can help you archive your tweets and directs messages, and delete your tweets, 
retweets, likes, and direct messages.`;
                this.instructions = `${this.actionString}

**To get started, log in to your X account below.**`;
                this.showBrowser = true;
                this.showAutomationNotice = false;
                await this.login();
                this.state = State.Dashboard;
                break;

            case State.Dashboard:
                this.showBrowser = false;
                await this.loadURL("about:blank");
                this.instructions = `
You're signed into **@${this.account.xAccount?.username}** on X.

You can make a local archive of your data, or you delete exactly what you choose to. What would you like to do?
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
                    this.instructions += `I have **archived ${this.progress?.newTweetsArchived.toLocaleString()} tweets**.`
                } else if (this.account.xAccount?.archiveTweets && this.account.xAccount?.archiveDMs) {
                    this.instructions += `I have **archived ${this.progress?.newTweetsArchived.toLocaleString()} tweets** and **indexed ${this.progress?.conversationsIndexed} conversations**, including **${this.progress?.messagesIndexed} messages**.`
                } else if (!this.account.xAccount?.archiveTweets && this.account.xAccount?.archiveDMs) {
                    this.instructions += `I have **indexed ${this.progress?.conversationsIndexed} conversations**, including **${this.progress?.messagesIndexed} messages**.`
                }
                break;
        }
    }
}