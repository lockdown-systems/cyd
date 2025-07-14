import { WebviewTag } from 'electron';
import { BaseViewModel, TimeoutError, InternetDownError, URLChangedError } from './BaseViewModel';
import {
    ArchiveInfo,
    FacebookDatabaseStats,
    FacebookDeletePostsStartResponse,
    FacebookJob,
    FacebookPostItem,
    FacebookProgress,
    emptyArchiveInfo,
    emptyFacebookDatabaseStats,
    emptyFacebookProgress
} from '../../../shared_types';
import { PlausibleEvents } from "../types";
import { AutomationErrorType } from '../automation_errors';
import { formatError, getJobsType } from '../util';
import { facebookHasSomeData } from '../util_facebook';


export enum State {
    Login = "Login",

    WizardStart = "WizardStart",

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

export function findCurrentUserInitialData(data: unknown): CurrentUserInitialData | null {
    // If the current item is an array, iterate through its elements
    if (Array.isArray(data)) {
        for (const item of data) {
            // Check if the first element is "CurrentUserInitialData"
            if (Array.isArray(item) && item[0] === "CurrentUserInitialData") {
                // Check if the third element is an object with the required keys
                if (
                    item[2] &&
                    typeof item[2] === "object" &&
                    "ACCOUNT_ID" in item[2] &&
                    "USER_ID" in item[2] &&
                    "NAME" in item[2]
                ) {
                    return item[2] as CurrentUserInitialData;
                }
            }
            // Recursively search nested arrays
            const result = findCurrentUserInitialData(item);
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
                const result = findCurrentUserInitialData(obj[key]);
                if (result) {
                    return result;
                }
            }
        }
    }
    // If nothing is found, return null
    return null;
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
    public databaseStats: FacebookDatabaseStats = emptyFacebookDatabaseStats();
    public archiveInfo: ArchiveInfo = emptyArchiveInfo();

    // Variables related to debugging
    public debugAutopauseEndOfStep: boolean = false;

    async init(webview: WebviewTag) {
        if (this.account && this.account?.facebookAccount && this.account?.facebookAccount.accountID) {
            this.state = State.WizardStart;
        } else {
            this.state = State.Login;
        }

        this.currentJobIndex = 0;

        await this.refreshDatabaseStats();

        super.init(webview);
    }

     async refreshDatabaseStats() {
        this.databaseStats = await window.electron.Facebook.getDatabaseStats(this.account.id);
        this.archiveInfo = await window.electron.archive.getInfo(this.account.id);
        this.emitter?.emit(`facebook-update-database-stats-${this.account.id}`);
        this.emitter?.emit(`facebook-update-archive-info-${this.account.id}`);
    }

    async defineJobs() {
        let shouldBuildArchive = false;
        const hasSomeData = await facebookHasSomeData(this.account.id);

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

        if (jobsType === "delete") {
            if (hasSomeData && this.account.facebookAccount?.deletePosts) {
                jobTypes.push("deletePosts");
                // shouldBuildArchive = true;
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

    async loadFacebookURL(url: string) {
        this.log("loadFacebookURL", url);

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

            // TODO: handle redirects, Facebook rate limits

            // Finished successfully so break out of the loop
            this.log("loadFacebookURL", "finished loading URL");
            break;
        }
    }

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

        // Start MITM to get the GraphQL data
        await this.loadBlank();
        await window.electron.Facebook.indexStart(this.account.id);
        await this.sleep(2000);

        // Start the progress
        this.progress.isSavePostsFinished = false;
        this.progress.storiesSaved = 0;
        await this.syncProgress();

        // Load the Facebook profile page
        const facebookProfileURL = `https://www.facebook.com/profile.php?id=${this.account.facebookAccount?.accountID}`;
        await this.loadFacebookURL(facebookProfileURL);
        await this.sleep(2000);

        // Try to click "Manage posts" button to get the graphQL request containing the posts
        const managedPostsButtonSelector = 'div[role="main"] > div:last-child > div:last-child > div > div:last-child > div:nth-child(2) > div > div > div:first-child > div:last-child > div > div:last-child > div[role="button"]';
        try {
            // wait for the "Manage posts" button to appear
            await this.waitForSelector(managedPostsButtonSelector, facebookProfileURL);

            // Click the "Manage posts" button
            await this.scriptClickElement(managedPostsButtonSelector);
            await this.sleep(2000);
        } catch (e) {
            this.log("runJobSavePosts", ["selector never appeared", e]);
            if (e instanceof TimeoutError) {
                await this.error(AutomationErrorType.facebook_runJob_savePosts_Timeout, {
                    error: formatError(e as Error)
                }, {
                    currentURL: this.webview?.getURL()
                });
            } else if (e instanceof URLChangedError) {
                const newURL = this.webview?.getURL();
                await this.error(AutomationErrorType.facebook_runJob_savePosts_URLChanged, {
                    newURL: newURL,
                    error: formatError(e as Error)
                }, {
                    currentURL: this.webview?.getURL()
                });
            } else {
                await this.error(AutomationErrorType.facebook_runJob_savePosts_OtherError, {
                    error: formatError(e as Error)
                }, {
                    currentURL: this.webview?.getURL()
                });
            }
        }

        await this.waitForLoadingToFinish();
        await this.sleep(500);

        // Scroll to the bottom of the manage posts dialog
        await this.webview?.executeJavaScript(`
            (function() {
                async function scrollToBottom(scrollDiv) {
                    while (scrollDiv.scrollTop + scrollDiv.clientHeight < scrollDiv.scrollHeight) {
                        scrollDiv.scrollTop += 100;
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    console.log("Reached the bottom of the div");
                }

                const dialogEls = document.querySelectorAll('div[role="dialog"]');
                const scrollDiv = dialogEls[1]?.querySelector('div > div:nth-of-type(4) > div');
                if (scrollDiv) {
                    scrollToBottom(scrollDiv);
                } else {
                    console.error("Scroll div not found");
                }
            })();
        `);

        await this.waitForLoadingToFinish();
        await this.sleep(500);

        // Save the first batch of posts
        this.progress = await window.electron.Facebook.savePosts(this.account.id);

        this.pause();
        await this.waitForPause();

        // TODO: click Next over and over in a loop until we get all posts

        // Stop MITM
        await window.electron.Facebook.indexStop(this.account.id);

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

    async runJobDeletePosts(jobIndex: number) {
        await window.electron.trackEvent(PlausibleEvents.FACEBOOK_JOB_STARTED_DELETE_POSTS, navigator.userAgent);

        // this.showBrowser = true;
        let postsToDelete: FacebookDeletePostsStartResponse;
        this.instructions = `**I'm deleting your posts based on your criteria, starting with the earliest.**`;

        this.showAutomationNotice = false;

        // TODO: implement

        // Load the posts to delete
        try {
            postsToDelete = await window.electron.Facebook.deletePostsStart(this.account.id);
        } catch (e) {
            await this.error(AutomationErrorType.facebook_runJob_deletePosts_FailedToStart, {
                error: formatError(e as Error)
            })
            return false;
        }
        this.log('runJobDeletePosts', `found ${postsToDelete.posts.length} posts to delete`);

        // Start the progress
        this.progress.totalPostsToDelete = postsToDelete.posts.length;
        this.progress.postsDeleted = 0;
        await this.syncProgress();

        // Delete posts
        for (let i = 0; i < postsToDelete.posts.length; i++) {
            const currentPostItem: FacebookPostItem | null = postsToDelete.posts[i];

            // Delete the post
            let postDeleted = false;
            let statusCode = 0;
            for (let tries = 0; tries < 3; tries++) {
                statusCode = await this.graphqlDelete(
                    ct0,
                    'https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet',
                    "https://x.com/" + this.account.xAccount?.username + "/with_replies",
                    JSON.stringify({
                        "variables": {
                            "tweet_id": currentPostItem.id,
                            "dark_request": false
                        },
                        "queryId": "VaenaVgh5q5ih7kvyVjgtg"
                    }),
                );
                if (statusCode == 200) {
                    // Update the post's deletedAt date
                    try {
                        await window.electron.Facebook.deletePost(this.account.id, currentPostItem.id, "post");
                        postDeleted = true;
                        this.progress.postsDeleted += 1;
                        await this.syncProgress();
                    } catch (e) {
                        await this.error(AutomationErrorType.facebook_runJob_deletePosts_FailedToUpdateDeleteTimestamp, {
                            error: formatError(e as Error)
                        }, {
                            post: currentPostItem,
                            index: i
                        }, true)
                    }
                    break;
                } else if (statusCode == 429) {
                    // Rate limited
                    this.log('runJobDeletePosts', 'Rate limited')
                    // this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                    // await this.waitForRateLimit();
                    tries = 0;
                } else {
                    // Sleep 1 second and try again
                    this.log("runJobDeleteposts", ["statusCode", statusCode, "failed to delete post, try #", tries]);
                    await this.sleep(1000);
                }
            }

            if (!postDeleted) {
                await this.error(AutomationErrorType.facebook_runJob_deletePosts_FailedToDelete, {
                    statusCode: statusCode
                }, {
                    post: currentPostItem,
                    index: i
                }, true)

                this.progress.errorsOccured += 1;
                await this.syncProgress();
            }

            await this.waitForPause();
        }

        this.pause();
        await this.waitForPause();

        await this.finishJob(jobIndex);
    }

    async runJobArchiveBuild(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.FACEBOOK_JOB_STARTED_ARCHIVE_BUILD, navigator.userAgent);

        this.showBrowser = true;
        this.instructions = `**I'm building a searchable archive web page in HTML.**`;
        this.showAutomationNotice = true;

        // Build the archive
        try {
            await window.electron.Facebook.archiveBuild(this.account.id);
            this.emitter?.emit(`facebook-update-archive-info-${this.account.id}`);
        } catch (e) {
            await this.error(AutomationErrorType.facebook_runJob_archiveBuild_ArchiveBuildError, {
                error: formatError(e as Error)
            })
            return false;
        }

        // Submit progress to the API
        this.emitter?.emit(`x-submit-progress-${this.account.id}`)

        this.pause();
        await this.waitForPause();

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

                    this.state = State.WizardBuildOptions;
                    break;

                case State.WizardBuildOptions:
                    this.showBrowser = false;
                    this.instructions = `
**I need a local database of the data in your Facebook account before I can delete it.**

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

                    await this.refreshDatabaseStats();

                    // Determine the next state
                    this.state = State.FinishedRunningJobs;

                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    break;

                case State.FinishedRunningJobs:
                    this.showBrowser = false;
                    this.instructions = `
All done!

**Here's what I did.**`;
                    await this.loadURL("about:blank");
                    this.state = State.FinishedRunningJobsDisplay;
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
