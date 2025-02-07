import { WebviewTag } from 'electron';
import { BaseViewModel } from './BaseViewModel';
import {
    FacebookJob,
    FacebookProgress,
    emptyFacebookProgress
} from '../../../shared_types';
import { PlausibleEvents } from "../types";
import { AutomationErrorType } from '../automation_errors';
import { facebookHasSomeData } from '../util_facebook';

export enum State {
    Login = "Login",

    WizardStart = "WizardStart",

    WizardImportOrBuild = "WizardImportOrBuild",
    WizardImportOrBuildDisplay = "WizardImportOrBuildDisplay",

    WizardCheckPremium = "WizardCheckPremium",
    WizardCheckPremiumDisplay = "WizardCheckPremiumDisplay",

    RunJobs = "RunJobs",

    Debug = "Debug",
}

export type FacebookViewModelState = {
    state: State;
    action: string;
    actionString: string;
    progress: FacebookProgress;
    jobs: FacebookJob[];
    currentJobIndex: number;
}

export class FacebookViewModel extends BaseViewModel {
    public progress: FacebookProgress = emptyFacebookProgress();
    public jobs: FacebookJob[] = [];
    public currentJobIndex: number = 0;

    // Variables related to debugging
    public debugAutopauseEndOfStep: boolean = false;

    async init(webview: WebviewTag) {
        if (this.account && this.account?.facebookAccount && this.account?.facebookAccount.accountID) {
            this.state = State.WizardStart;
        } else {
            this.state = State.Login;
        }

        this.currentJobIndex = 0;

        super.init(webview);
    }

    async defineJobs() {
        let shouldBuildArchive = false;
        const hasSomeData = await facebookHasSomeData(this.account?.id);

        const jobTypes = [];
        jobTypes.push("login");

        if (this.account?.facebookAccount?.saveMyData) {
            shouldBuildArchive = true;
            if (this.account?.facebookAccount?.savePosts) {
                jobTypes.push("savePosts");
                if (this.account?.facebookAccount?.savePostsHTML) {
                    jobTypes.push("savePostsHTML");
                }
            }
        }

        if (this.account?.facebookAccount?.deleteMyData) {
            if (hasSomeData && this.account?.facebookAccount?.deletePosts) {
                jobTypes.push("deletePosts");
                shouldBuildArchive = true;
            }
        }

        if (shouldBuildArchive) {
            jobTypes.push("archiveBuild");
        }

        try {
            this.jobs = await window.electron.Facebook.createJobs(this.account?.id, jobTypes);
            this.log("defineJobs", JSON.parse(JSON.stringify(this.jobs)));
        } catch (e) {
            await this.error(AutomationErrorType.facebook_unknownError, {
                exception: (e as Error).toString()
            }, {
                currentURL: this.webview?.getURL()
            });
            return;
        }
    }

    async reset() {
        this.progress = emptyFacebookProgress();
        this.jobs = [];
        this.state = State.WizardStart;
    }

    async finishJob(jobIndex: number) {
        const finishedAt = new Date();
        this.jobs[jobIndex].finishedAt = finishedAt;
        this.jobs[jobIndex].status = "finished";
        this.jobs[jobIndex].progressJSON = JSON.stringify(this.progress);
        await window.electron.Facebook.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));
        await window.electron.Facebook.setConfig(
            this.account?.id,
            `lastFinishedJob_${this.jobs[jobIndex].jobType}`,
            finishedAt.toISOString()
        );
        this.log("finishJob", this.jobs[jobIndex].jobType);
    }

    async errorJob(jobIndex: number) {
        this.jobs[jobIndex].finishedAt = new Date();
        this.jobs[jobIndex].status = "error";
        this.jobs[jobIndex].progressJSON = JSON.stringify(this.progress);
        await window.electron.Facebook.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));
        this.log("errorJob", this.jobs[jobIndex].jobType);
    }

    async syncProgress() {
        await window.electron.Facebook.syncProgress(this.account?.id, JSON.stringify(this.progress));
    }

    async login() {
        // TODO: implement
    }

    async runJobLogin(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.FACEBOOK_JOB_STARTED_LOGIN, navigator.userAgent);

        this.showBrowser = true;
        this.instructions = `Checking to see if you're still logged in to your Facebook account...`;

        this.showAutomationNotice = false;

        await this.login();

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobSavePosts(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.FACEBOOK_JOB_STARTED_SAVE_POSTS, navigator.userAgent);

        this.showBrowser = true;
        this.instructions = `Instructions here...`;

        this.showAutomationNotice = false;

        // TODO: implement

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobSavePostsHTML(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.FACEBOOK_JOB_STARTED_SAVE_POSTS_HTML, navigator.userAgent);

        this.showBrowser = true;
        this.instructions = `Instructions here...`;

        this.showAutomationNotice = false;

        // TODO: implement

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobDeletePosts(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.FACEBOOK_JOB_STARTED_DELETE_POSTS, navigator.userAgent);

        this.showBrowser = true;
        this.instructions = `Instructions here...`;

        this.showAutomationNotice = false;

        // TODO: implement

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobArchiveBuild(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.FACEBOOK_JOB_STARTED_ARCHIVE_BUILD, navigator.userAgent);

        this.showBrowser = true;
        this.instructions = `Instructions here...`;

        this.showAutomationNotice = false;

        // TODO: implement

        await this.finishJob(jobIndex);
        return true;
    }

    async runJob(jobIndex: number) {
        // Reset logs before each job, so the sensitive context data in error reports will only includes
        // logs from the current job
        this.resetLogs();

        await this.waitForPause();

        // Start the job
        this.jobs[jobIndex].startedAt = new Date();
        this.jobs[jobIndex].status = "running";
        await window.electron.Facebook.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));

        // Set the current job immediately
        this.progress.currentJob = this.jobs[jobIndex].jobType;
        await this.syncProgress();

        this.log("runJob", `running job ${this.jobs[jobIndex].jobType}`);
        switch (this.jobs[jobIndex].jobType) {
            case "login":
                await this.runJobLogin(jobIndex);
                break;

            case "savePosts":
                await this.runJobSavePosts(jobIndex);
                break;

            case "savePostsHTML":
                await this.runJobSavePostsHTML(jobIndex);
                break;

            case "deletePosts":
                await this.runJobDeletePosts(jobIndex);
                break;

            case "archiveBuild":
                await this.runJobArchiveBuild(jobIndex);
                break;
        }
    }

    async run() {
        // Reset logs before running any state
        this.resetLogs();

        this.log("run", `running state: ${this.state}`);
        try {
            switch (this.state) {
                case State.Login:
                    this.actionString = `Hello, friend! My name is **Cyd**. I can help you save and delete your posts from Facebook.`;
                    this.instructions = `${this.actionString}

**To get started, log in to your Facebook account below.**`;
                    this.showBrowser = true;
                    this.showAutomationNotice = false;
                    await this.login();
                    this.state = State.WizardStart;
                    break;

                case State.WizardStart:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    this.state = State.WizardImportOrBuild;
                    break;

                case State.WizardImportOrBuild:
                    this.showBrowser = false;
                    this.instructions = `
**I need a local database of the data in your Facebook account before I can delete it.**

You can either import a Facebook archive, or I can build it from scratch by scrolling through your profile.`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardImportOrBuildDisplay;
                    break;

                case State.Debug:
                    // Stay in this state until the user cancels it
                    this.showBrowser = false
                    await this.loadURL("about:blank");
                    this.instructions = `I'm in my debug state.`;
                    while (this.state === State.Debug) {
                        await this.sleep(1000);
                    }
                    break;
            }
        } catch (e) {
            await this.error(AutomationErrorType.x_runError, {
                exception: (e as Error).toString(),
                state: this.state,
                jobs: this.jobs,
                currentJobIndex: this.currentJobIndex,
            });
        }
    }

    saveState(): FacebookViewModelState {
        return {
            "state": this.state as State,
            "action": this.action,
            "actionString": this.actionString,
            "progress": this.progress,
            "jobs": this.jobs,
            "currentJobIndex": this.currentJobIndex,
        }
    }

    restoreState(state: FacebookViewModelState) {
        this.state = state.state;
        this.action = state.action;
        this.actionString = state.actionString;
        this.progress = state.progress;
        this.jobs = state.jobs;
        this.currentJobIndex = state.currentJobIndex;
    }
}
