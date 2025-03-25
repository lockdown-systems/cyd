import { WebviewTag } from 'electron';
import { BaseViewModel, InternetDownError, URLChangedError } from './BaseViewModel';
import {
    FacebookJob,
    FacebookProgress,
    emptyFacebookProgress
} from '../../../shared_types';
import { PlausibleEvents } from "../types";
import { AutomationErrorType } from '../automation_errors';
import { formatError, getJobsType } from '../util';

export enum State {
    Login = "Login",

    WizardStart = "WizardStart",

    WizardDatabase = "WizardDatabase",
    WizardDatabaseDisplay = "WizardDatabaseDisplay",

    WizardImportStart = "WizardImportStart",
    WizardImportStartDisplay = "WizardImportStartDisplay",
    WizardImportDownload = "WizardImportDownload",
    WizardImportDownloadDisplay = "WizardImportDownloadDisplay",
    WizardImporting = "WizardImporting",
    WizardImportingDisplay = "WizardImportingDisplay",

    WizardBuildOptions = "WizardBuildOptions",
    WizardBuildOptionsDisplay = "WizardBuildOptionsDisplay",

    WizardArchiveOptions = "WizardArchiveOptions",
    WizardArchiveOptionsDisplay = "WizardArchiveOptionsDisplay",

    WizardDeleteOptions = "WizardDeleteOptions",
    WizardDeleteOptionsDisplay = "WizardDeleteOptionsDisplay",

    WizardCheckPremium = "WizardCheckPremium",
    WizardCheckPremiumDisplay = "WizardCheckPremiumDisplay",

    WizardReview = "WizardReview",
    WizardReviewDisplay = "WizardReviewDisplay",

    WizardDeleteReview = "WizardDeleteReview",
    WizardDeleteReviewDisplay = "WizardDeleteReviewDisplay",

    RunJobs = "RunJobs",

    FinishedRunningJobs = "FinishedRunningJobs",
    FinishedRunningJobsDisplay = "FinishedRunningJobsDisplay",

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

// For traversing the Facebook JSON data embedded in the HTML

interface FacebookDataItem {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export interface CurrentUserInitialData {
    ACCOUNT_ID: string;
    USER_ID: string;
    NAME: string;
    [key: string]: unknown;
}

export function findDataFromFacebookHTML(data: unknown, type: string): object | null {
    // If the current item is an array, iterate through its elements
    if (Array.isArray(data)) {
        for (const item of data) {
            // Check if the first element is "CurrentUserInitialData"
            if (Array.isArray(item) && item[0] === "CurrentUserInitialData" && type === "user") {
                // Check if the third element is an object with the required keys
                if (
                    item[2] &&
                    typeof item[2] === "object" &&
                    "ACCOUNT_ID" in item[2] &&
                    "USER_ID" in item[2] &&
                    "NAME" in item[2]
                ) {
                    return item[2];
                }
            } else if (Array.isArray(item) && item[0] === "RelayPrefetchedStreamCache" && type === "firstPost") {
                if (item[3] && item[3][1]) {
                    return item[3][1]["__bbox"]?.["result"]?.["data"]?.["user"]?.["timeline_list_feed_units"]?.["edges"];
                }
            }
            // Recursively search nested arrays
            const result = findDataFromFacebookHTML(item, type);
            if (result) {
                return result;
            }
        }
    }
    // If the current item is an object, recursively search its values
    else if (typeof data === "object" && data !== null) {
        // Use type assertion for object iteration
        const obj = data as Record<string, unknown>;
        for (const key of Object.keys(obj)) {
            // Safe property check
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const result = findDataFromFacebookHTML(obj[key], type);
                if (result) {
                    return result;
                }
            }
        }
    }
    // If nothing is found, return null
    return null;
}

export function findCurrentUserInitialData(data: unknown): CurrentUserInitialData | null {
    return findDataFromFacebookHTML(data, "user") as CurrentUserInitialData;
}

export function findFirstPostData(data: unknown) {
    return findDataFromFacebookHTML(data, "firstPost");
}

export function findProfilePictureURI(data: unknown): string | null {
    // Handle arrays by checking each element
    if (Array.isArray(data)) {
        for (const item of data) {
            const result = findProfilePictureURI(item);
            if (result) return result;
        }
    }
    // Handle objects
    else if (typeof data === "object" && data !== null) {
        const obj = data as Record<string, unknown>;

        // Check if this is the actor object we're looking for
        if (obj.actor && typeof obj.actor === "object") {
            const actor = obj.actor as Record<string, unknown>;
            if (actor.__typename === "User" &&
                actor.profile_picture &&
                typeof actor.profile_picture === "object") {
                const profilePicture = actor.profile_picture as Record<string, unknown>;
                if (typeof profilePicture.uri === "string") {
                    return profilePicture.uri;
                }
            }
        }

        // Recursively search through all object properties
        for (const key of Object.keys(obj)) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const result = findProfilePictureURI(obj[key]);
                if (result) return result;
            }
        }
    }
    return null;
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

        const jobsType = getJobsType(this.account.id);

        const jobTypes = [];
        jobTypes.push("login");

        if (jobsType === "save") {
            shouldBuildArchive = true;
            if (this.account?.facebookAccount?.savePosts) {
                jobTypes.push("savePosts");
                if (this.account?.facebookAccount?.savePostsHTML) {
                    jobTypes.push("savePostsHTML");
                }
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
                error: formatError(e as Error)
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

    async loadFacebookURL(url: string, expectedURLs: (string | RegExp)[] = [], redirectOk: boolean = false) {
        this.log("loadFacebookURL", [url, expectedURLs, redirectOk]);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Load the URL
            try {
                await this.loadURL(url);
                this.log("loadFacebookURL", "URL loaded successfully");
            } catch (e) {
                if (e instanceof InternetDownError) {
                    this.log("loadFacebookURL", "internet is down");
                    this.emitter?.emit(`cancel-automation-${this.account?.id}`);
                } else {
                    await this.error(AutomationErrorType.facebook_loadURLError, {
                        url: url,
                        error: formatError(e as Error)
                    }, {
                        currentURL: this.webview?.getURL()
                    });
                }
                break;
            }

            // Did the URL change?
            if (!redirectOk) {
                this.log("loadFacebookURL", "checking if URL changed");
                const newURL = new URL(this.webview?.getURL() || '');
                const originalURL = new URL(url);
                // Check if the URL has changed, ignoring query strings
                // e.g. a change from https://www.facebook.com/ to https://www.facebook.com/?mx=2 is ok
                if (newURL.origin + newURL.pathname !== originalURL.origin + originalURL.pathname) {
                    let changedToUnexpected = true;
                    for (const expectedURL of expectedURLs) {
                        if (typeof expectedURL === 'string' && newURL.toString().startsWith(expectedURL)) {
                            changedToUnexpected = false;
                            break;
                        } else if (expectedURL instanceof RegExp && expectedURL.test(newURL.toString())) {
                            changedToUnexpected = false;
                            break;
                        }
                    }

                    if (changedToUnexpected) {
                        this.log("loadFacebookURL", `UNEXPECTED, URL change to ${this.webview?.getURL()}`);
                        throw new URLChangedError(url, this.webview?.getURL() || '');
                    } else {
                        this.log("loadFacebookURL", `expected, URL change to ${this.webview?.getURL()}`);
                    }
                }
            }

            // TODO: handle Facebook rate limits

            // Finished successfully so break out of the loop
            this.log("loadFacebookURL", "finished loading URL");
            break;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getFacebookDataFromHTML(): Promise<FacebookDataItem[]> {
        this.log("getFacebookData");

        // When loading the Facebook home page, there are dozens of `<script type="application/ld+json">` elements.
        // This function will extract the JSON data from each of them and return it as an array of objects.
        return await this.getWebview()?.executeJavaScript(`
            (async () => {
                const json = [];
                const scripts = document.querySelectorAll('script[type="application/json"]');
                for (const script of scripts) {
                    try {
                        const data = JSON.parse(script.textContent);
                        json.push(data);
                    } catch (e) {
                        console.error(e);
                    }
                }
                return json;
            })();
        `);
    }

    async login() {
        this.showBrowser = true;
        this.log("login", "logging in");

        // Load facebook.com and see if we're logged in
        await this.loadFacebookURL("https://www.facebook.com");

        // Wait for the c_user cookie to be set

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const c_user = await window.electron.Facebook.getCookie(this.account?.id, "c_user");
            if (c_user !== null) {
                this.log("login", "logged in");
                break;
            }
            await this.sleep(1000);
        }

        // We're logged in
        this.log("login", "login succeeded");
        this.showAutomationNotice = true;

        // If this is the first time we're logging in, track it
        if (this.state === State.Login) {
            await window.electron.trackEvent(PlausibleEvents.FACEBOOK_USER_SIGNED_IN, navigator.userAgent);
        }

        await this.waitForPause();

        // Get the user's name and account ID
        const facebookData = await this.getFacebookDataFromHTML();
        const currentUserInitialData = findCurrentUserInitialData(facebookData);
        console.log('currentUserInitialData', currentUserInitialData);

        if (currentUserInitialData && this.account && this.account?.facebookAccount) {
            this.account.facebookAccount.name = currentUserInitialData.NAME;
            this.account.facebookAccount.accountID = currentUserInitialData.ACCOUNT_ID;
        }

        // Get the user's profile image
        const profilePictureURI = findProfilePictureURI(facebookData);
        console.log('profilePictureURI', profilePictureURI);
        if (profilePictureURI && this.account && this.account.facebookAccount) {
            this.account.facebookAccount.profileImageDataURI = await window.electron.Facebook.getProfileImageDataURI(this.account.id, profilePictureURI);
        }

        await window.electron.database.saveAccount(JSON.stringify(this.account));

        await this.waitForPause();

        // See if we're being asked to trust this device
        await this.sleep(1000);
        const url = this.webview?.getURL() || '';
        if (url.startsWith('https://www.facebook.com/two_factor/remember_browser/')) {
            // Click "Trust this device" button
            console.log('Clicking "Trust this device"');
            await this.webview?.executeJavaScript(`document.querySelectorAll('div[role="button"]')[2].click()`);
            await this.sleep(1000);
            await this.waitForLoadingToFinish();
        }

        console.log("Logged into Facebook");
        this.showBrowser = false;
    }

    async downloadHTMLPostJSON() {
        this.showBrowser = true;
        this.log("Posts", "Loading facebook wall posts");

        // load facebook wall URL and get scripts
        await this.loadFacebookURL(`https://www.facebook.com/profile.php?id=${this.account.facebookAccount?.accountID}`);
        await this.sleep(500);
        const facebookData = await this.getFacebookDataFromHTML();
        const latestPostData = findFirstPostData(facebookData)
        console.log('facebookData', latestPostData);

        return latestPostData;
    }

    async parseFacebookPostData() {
        console.log("Is it here?");

        // Parse JSON in HTML
        const latestPostData = await this.downloadHTMLPostJSON();
        if (latestPostData) {
            await window.electron.Facebook.saveParseHTMLPostData(this.account.id, { "data": latestPostData });
        }

        // Start MITM to get the GraphQL data
        await this.loadBlank();
        await window.electron.Facebook.indexStart(this.account.id);
        await this.sleep(2000);

        await this.loadFacebookURL(`https://www.facebook.com/profile.php?id=${this.account.facebookAccount?.accountID}`);
        await this.sleep(500);

        await window.electron.Facebook.saveGraphQLPostData(this.account.id);
        await window.electron.Facebook.indexStop(this.account.id);
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
        this.instructions = `This is saving posts...`;

        this.showAutomationNotice = true;

        this.pause();
        await this.waitForPause();

        await this.parseFacebookPostData();

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
        this.emitter?.emit(`facebook-update-archive-info-${this.account?.id}`);

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

                    if (!this.account.facebookAccount?.accountID || this.account.facebookAccount?.accountID === "0") {
                        this.state = State.Login;
                        break;
                    }

                    this.state = State.WizardDatabase;
                    break;

                case State.WizardDatabase:
                    this.showBrowser = false;
                    this.instructions = `
**I need a local database of the data in your Facebook account before I can delete it.**

You can either import a Facebook archive, or I can build it from scratch by scrolling through your profile.`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardDatabaseDisplay;
                    break;

                case State.WizardImportStart:
                    this.showBrowser = false;
                    this.instructions = `
**Before you can import your Facebook archive, you need to download it.**`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardImportStartDisplay;
                    break;

                case State.WizardImportDownload:
                    this.showBrowser = false;
                    this.instructions = `You have requested your Facebook archive, so now we wait.`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardImportDownloadDisplay;
                    break;

                case State.WizardImporting:
                    this.showBrowser = false;
                    this.instructions = `I'll help you import your Facebook archive into your local database.`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardImportingDisplay;
                    break;

                case State.WizardBuildOptions:
                    this.showBrowser = false;
                    this.instructions = `
I'll help you build a private local database of your Facebook data to the \`Documents\` folder on your computer.
You'll be able to access it even after you delete it from Facebook.`;
                    await this.loadURL("about:blank");

                    this.state = State.WizardBuildOptionsDisplay;
                    break;

                case State.WizardReview:
                    this.showBrowser = false;
                    this.instructions = `I'm almost ready to start helping you claw back your data from Facebook!

**Here's what I'm planning on doing.**`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardReviewDisplay;
                    break;

                case State.WizardArchiveOptions:
                    this.showBrowser = false;
                    this.instructions = `I'll help you archive your Facebook account.`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardArchiveOptionsDisplay;
                    break;

                case State.WizardDeleteOptions:
                    this.showBrowser = false;
                    this.instructions = `
**Which data do you want to delete?**`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardDeleteOptionsDisplay;
                    break;

                case State.RunJobs:
                    this.progress = await window.electron.Facebook.resetProgress(this.account.id);

                    // Dismiss old error reports
                    await window.electron.database.dismissNewErrorReports(this.account.id);

                    // i is starting at currentJobIndex instead of 0, in case we restored state
                    for (let i = this.currentJobIndex; i < this.jobs.length; i++) {
                        this.currentJobIndex = i;
                        try {
                            await this.runJob(i);
                            if (this.debugAutopauseEndOfStep) {
                                this.pause();
                                await this.waitForPause();
                            }
                        } catch (e) {
                            await this.error(AutomationErrorType.facebook_runJob_UnknownError, {
                                error: formatError(e as Error)
                            });
                            break;
                        }
                    }
                    this.currentJobIndex = 0;

                    // Determine the next state
                    this.state = State.FinishedRunningJobs;

                    this.showBrowser = false;
                    await this.loadURL("about:blank");
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
                error: formatError(e as Error),
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
