import { BaseViewModel } from './BaseViewModel';
import type { XJob, XProgress } from '../../../shared_types';

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

    async init() {
        this.state = State.Login;
        this.progress = null;
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

    async startArchiving() {
        this.action = "archive"

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

    async runJob(indexJob: number) {
        // Start the job
        this.jobs[indexJob].startedAt = new Date();
        this.jobs[indexJob].status = "running";
        await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[indexJob]));

        switch (this.jobs[indexJob].jobType) {
            case "index":
                this.showBrowser = true;
                this.instructions = `
Hang on while I scroll down to your earliest tweets that I've seen.
`;
                // Start monitoring network requests
                await window.electron.X.indexStart(this.account.id);

                // Load the timeline and wait for tweets to appear
                await this.loadURL("https://x.com/" + this.account.xAccount?.username + "/with_replies");
                await this.waitForSelector('article');

                while (this.progress === null || this.progress.isIndexFinished === false) {
                    // Scroll to bottom
                    const moreToScroll = await this.scrollToBottom();
                    if (!moreToScroll) {
                        this.progress = await window.electron.X.indexFinished(this.account.id);
                        break;
                    }

                    // Parse so far
                    this.progress = await window.electron.X.indexParse(this.account.id);
                    this.jobs[indexJob].progressJSON = JSON.stringify(this.progress);
                    await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[indexJob]));
                    console.log("progress", this.progress);

                    // Rate limited?
                    if (this.progress.isRateLimited) {
                        // TODO: handle rate limit
                        console.log("rate limited", this.progress);
                    }
                }

                // Stop monitoring network requests
                await window.electron.X.indexStop(this.account.id);

                // Job finished
                this.jobs[indexJob].finishedAt = new Date();
                this.jobs[indexJob].status = "finished";
                this.jobs[indexJob].progressJSON = JSON.stringify(this.progress);
                await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[indexJob]));

                break;

            case "archiveTweets":
                console.log("archiveTweets: NOT IMPLEMENTED");
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