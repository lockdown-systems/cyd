import { WebviewTag } from 'electron';
import { BaseViewModel, TimeoutError, URLChangedError, InternetDownError } from './BaseViewModel';
import {
    XJob,
    XProgress, emptyXProgress,
    XTweetItem,
    XArchiveStartResponse,
    XIndexMessagesStartResponse,
    XRateLimitInfo, emptyXRateLimitInfo,
    XProgressInfo, emptyXProgressInfo,
    XDeleteTweetsStartResponse,
    XDatabaseStats, emptyXDatabaseStats,
    XDeleteReviewStats, emptyXDeleteReviewStats,
    XArchiveInfo, emptyXArchiveInfo,
    XAccount
} from '../../../shared_types';
import { PlausibleEvents } from "../types";
import { AutomationErrorType } from '../automation_errors';
import { xHasSomeData } from '../util_x';

export enum State {
    Login = "Login",

    WizardPrestart = "WizardPrestart",
    WizardStart = "WizardStart",

    WizardImportOrBuild = "WizardImportOrBuild",
    WizardImportOrBuildDisplay = "WizardImportOrBuildDisplay",
    WizardImportStart = "WizardImportStart",
    WizardImportStartDisplay = "WizardImportStartDisplay",
    WizardImportDownload = "WizardImportDownload",
    WizardImportDownloadDisplay = "WizardImportDownloadDisplay",
    WizardImporting = "WizardImporting",
    WizardImportingDisplay = "WizardImportingDisplay",

    WizardBuildOptions = "WizardBuildOptions",
    WizardBuildOptionsDisplay = "WizardBuildOptionsDisplay",

    WizardDeleteOptions = "WizardDeleteOptions",
    WizardDeleteOptionsDisplay = "WizardDeleteOptionsDisplay",

    WizardReview = "WizardReview",
    WizardReviewDisplay = "WizardReviewDisplay",

    WizardDeleteReview = "WizardDeleteReview",
    WizardDeleteReviewDisplay = "WizardDeleteReviewDisplay",

    WizardCheckPremium = "WizardCheckPremium",
    WizardCheckPremiumDisplay = "WizardCheckPremiumDisplay",

    RunJobs = "RunJobs",

    FinishedRunningJobs = "FinishedRunningJobs",
    FinishedRunningJobsDisplay = "FinishedRunningJobsDisplay",

    Debug = "Debug",
}

export enum FailureState {
    indexTweets_FailedToRetryAfterRateLimit = "indexTweets_FailedToRetryAfterRateLimit",
    indexLikes_FailedToRetryAfterRateLimit = "indexLikes_FailedToRetryAfterRateLimit",
}

export type XViewModelState = {
    state: State;
    action: string;
    actionString: string;
    progress: XProgress;
    jobs: XJob[];
    currentJobIndex: number;
}

export class AccountXViewModel extends BaseViewModel {
    public progress: XProgress = emptyXProgress();
    public rateLimitInfo: XRateLimitInfo = emptyXRateLimitInfo();
    public progressInfo: XProgressInfo = emptyXProgressInfo();
    public databaseStats: XDatabaseStats = emptyXDatabaseStats();
    public deleteReviewStats: XDeleteReviewStats = emptyXDeleteReviewStats();
    public archiveInfo: XArchiveInfo = emptyXArchiveInfo();
    public jobs: XJob[] = [];
    public currentJobIndex: number = 0;

    // This is used to track the user's progress through the wizard. If they want to review before 
    // they delete, this lets them go back and change settings without starting over
    public isDeleteReviewActive: boolean = false;

    // Debug variables
    public debugAutopauseEndOfStep: boolean = false;

    async init(webview: WebviewTag) {
        if (this.account && this.account?.xAccount && this.account?.xAccount.username) {
            this.state = State.WizardPrestart;
        } else {
            this.state = State.Login;
        }

        this.currentJobIndex = 0;

        await this.refreshDatabaseStats();

        super.init(webview);
    }

    async refreshDatabaseStats() {
        this.databaseStats = await window.electron.X.getDatabaseStats(this.account?.id);
        this.deleteReviewStats = await window.electron.X.getDeleteReviewStats(this.account?.id);
        this.archiveInfo = await window.electron.X.getArchiveInfo(this.account?.id);
        this.emitter?.emit(`x-update-database-stats-${this.account?.id}`);
        this.emitter?.emit(`x-update-archive-info-${this.account?.id}`);
    }

    async defineJobs() {
        let shouldBuildArchive = false;
        const hasSomeData = await xHasSomeData(this.account?.id);

        const jobTypes = [];
        jobTypes.push("login");

        if (this.account?.xAccount?.saveMyData) {
            shouldBuildArchive = true;
            if (this.account?.xAccount?.archiveTweets) {
                jobTypes.push("indexTweets");
                if (this.account?.xAccount?.archiveTweetsHTML) {
                    jobTypes.push("archiveTweets");
                }
            }
            if (this.account?.xAccount?.archiveLikes) {
                jobTypes.push("indexLikes");
            }
            if (this.account?.xAccount?.archiveDMs) {
                jobTypes.push("indexConversations");
                jobTypes.push("indexMessages");
            }
        }

        if (this.account?.xAccount?.deleteMyData) {
            if (hasSomeData && this.account?.xAccount?.deleteTweets) {
                jobTypes.push("deleteTweets");
                shouldBuildArchive = true;
            }
            if (hasSomeData && this.account?.xAccount?.deleteRetweets) {
                jobTypes.push("deleteRetweets");
                shouldBuildArchive = true;
            }
            if (hasSomeData && this.account?.xAccount?.deleteLikes) {
                jobTypes.push("deleteLikes");
                shouldBuildArchive = true;
            }
            if (this.account?.xAccount?.unfollowEveryone) {
                jobTypes.push("unfollowEveryone");
            }
            if (this.account?.xAccount?.deleteDMs) {
                jobTypes.push("deleteDMs");
            }
        }

        if (shouldBuildArchive) {
            jobTypes.push("archiveBuild");
        }

        try {
            this.jobs = await window.electron.X.createJobs(this.account?.id, jobTypes);
            this.log("defineJobs", JSON.parse(JSON.stringify(this.jobs)));
        } catch (e) {
            await this.error(AutomationErrorType.x_unknownError, {
                exception: (e as Error).toString()
            }, {
                currentURL: this.webview?.getURL()
            });
            return;
        }
    }

    async defineJobsDownloadArchive() {
        const jobTypes = ["login", "downloadArchive"];

        try {
            this.jobs = await window.electron.X.createJobs(this.account?.id, jobTypes);
            this.log("defineJobsDownloadArchive", JSON.parse(JSON.stringify(this.jobs)));
        } catch (e) {
            await this.error(AutomationErrorType.x_unknownError, {
                exception: (e as Error).toString()
            }, {
                currentURL: this.webview?.getURL()
            });
            return;
        }
    }

    async reset() {
        this.progress = emptyXProgress();
        this.rateLimitInfo = emptyXRateLimitInfo();
        this.jobs = [];
        this.state = State.WizardPrestart;
    }

    async waitForRateLimit() {
        this.log("waitForRateLimit", this.rateLimitInfo);

        let seconds = 0;
        if (this.rateLimitInfo.rateLimitReset) {
            seconds = this.rateLimitInfo.rateLimitReset - Math.floor(Date.now() / 1000);
        }
        await this.sleep(seconds * 1000);
        this.log("waitForRateLimit", "finished waiting for rate limit");

        // Wait for the user to unpause.
        // This is important because if the computer sleeps and autopauses during a rate limit, this will
        // continue to wait until after the computer wakes up.
        await this.waitForPause();
        this.log("waitForRateLimit", "finished waiting for pause");
    }

    async loadURLWithRateLimit(url: string, expectedURLs: (string | RegExp)[] = [], redirectOk: boolean = false) {
        this.log("loadURLWithRateLimit", [url, expectedURLs, redirectOk]);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Reset the rate limit checker
            await window.electron.X.resetRateLimitInfo(this.account?.id);

            // Load the URL
            try {
                await this.loadURL(url);
                this.log("loadURLWithRateLimit", "URL loaded successfully");
            } catch (e) {
                if (e instanceof InternetDownError) {
                    this.log("loadURLWithRateLimit", "internet is down");
                    this.emitter?.emit(`cancel-automation-${this.account?.id}`);
                } else {
                    await this.error(AutomationErrorType.x_loadURLError, {
                        url: url,
                        exception: (e as Error).toString()
                    }, {
                        currentURL: this.webview?.getURL()
                    });
                }
                break;
            }

            // Did the URL change?
            if (!redirectOk) {
                this.log("loadURLWithRateLimit", "checking if URL changed");
                const newURL = new URL(this.webview?.getURL() || '');
                const originalURL = new URL(url);
                // Check if the URL has changed, ignoring query strings
                // e.g. a change from https://x.com/login to https://x.com/login?mx=2 is ok
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
                        this.log("loadURLWithRateLimit", `UNEXPECTED, URL change to ${this.webview?.getURL()}`);
                        throw new URLChangedError(url, this.webview?.getURL() || '');
                    } else {
                        this.log("loadURLWithRateLimit", `expected, URL change to ${this.webview?.getURL()}`);
                    }
                }
            }

            // Were we rate limited?
            this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
            if (this.rateLimitInfo.isRateLimited) {
                await this.waitForRateLimit();
                this.log("loadURLWithRateLimit", "waiting for rate limit finished, trying to load the URL again");
                // Continue on the next iteration of the loop to try again
                continue;
            }

            // Finished successfully so break out of the loop
            this.log("loadURLWithRateLimit", "finished loading URL");
            break;
        }
    }

    async syncProgress() {
        await window.electron.X.syncProgress(this.account?.id, JSON.stringify(this.progress));
    }

    async indexTweetsHandleRateLimit(): Promise<boolean> {
        this.log("indexTweetsHandleRateLimit", this.progress);

        await this.waitForPause();

        if (await this.doesSelectorExist('section [data-testid="cellInnerDiv"]')) {
            this.log("indexTweetsHandleRateLimit", "tweets have loaded");
            // Tweets have loaded. If there are tweets, the HTML looks like of like this:
            // <section>
            //     <div>
            //         <div>
            //             <div data-testid="cellInnerDiv"></div>
            //             <div data-testid="cellInnerDiv"></div>
            //             <div data-testid="cellInnerDiv>...</div>
            //                 <div>...</div>
            //                 <button>...</button>
            //             </div>
            //         </div>
            //     </div>
            // </section>

            // If the retry button does not exist, try scrolling up and down again to trigger it
            // The retry button should be in the last cellInnerDiv, and it should have only 1 button in it
            if (await this.countSelectorsWithinElementLastFound('main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]', 'button') != 1) {
                await this.scrollUp(2000);
                await this.sleep(2000);
                await this.scrollToBottom();
                await this.sleep(2000);
                if (await this.countSelectorsWithinElementLastFound('main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]', 'button') != 1) {
                    this.log("indexTweetsHandleRateLimit", "retry button does not exist");
                    return false;
                }
            }

            // Count divs before clicking retry button
            let numberOfDivsBefore = await this.countSelectorsFound('section div[data-testid=cellInnerDiv]');
            if (numberOfDivsBefore > 0) {
                // The last one is the one with the button
                numberOfDivsBefore--;
            }

            // Click the retry button
            await this.scriptClickElementWithinElementLast('main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]', 'button');
            await this.sleep(2000);

            // Count divs after clicking retry button
            const numberOfDivsAfter = await this.countSelectorsFound('section div[data-testid=cellInnerDiv]');

            // If there are more divs after, it means more tweets loaded
            return numberOfDivsAfter > numberOfDivsBefore;

        } else {
            this.log("indexTweetsHandleRateLimit", "no tweets have loaded");
            // No tweets have loaded. If there are no tweets, the HTML looks kind of like this:
            // <main role="main">
            //     <div>
            //         <div>
            //             <div>
            //                 <div>
            //                     <div>
            //                         <nav role="navigation">
            //                         <div>
            //                             <div>...</div>
            //                             <button>...</button>
            //                         </div>
            //                     </div>
            //                 </div>
            //             </div>
            //         </div>
            //     </div>
            // </main>

            // Click retry button
            await this.scriptClickElement('main[role="main"] nav[role="navigation"] + div > button');

            // Count divs after clicking retry button
            const numberOfDivsAfter = await this.countSelectorsFound('section div[data-testid=cellInnerDiv]');

            // If there are more divs after, it means more tweets loaded
            return numberOfDivsAfter > 0;
        }
    }

    // Check if there is a "Something went wrong" message, and click retry if there is
    async indexTweetsCheckForSomethingWrong(): Promise<void> {
        // X might show a "Something went wrong" message if an AJAX request fails for a reason other than
        // being rate limited. If this happens, we need to click the retry button to try again.
        if (
            await this.doesSelectorExist('section div[data-testid="cellInnerDiv"]') &&
            // If the last cellInnerDiv has just one button, that should be the retry button
            await this.countSelectorsWithinElementLastFound('main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]', 'button') == 1
        ) {
            // Click retry
            await this.scriptClickElementWithinElementLast('main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]', 'button');
            await this.sleep(2000);
        }
    }

    // When we get to the bottom of a tweets or likes feed, verify that we're actually
    // at the bottom. Do this by scrolling up, then down again, and making sure we still got the
    // final API response.
    // Returns true if we're actually at the bottom, false if we're not.
    async indexTweetsVerifyThereIsNoMore(): Promise<boolean> {
        this.log("indexTweetsVerifyThereIsNoMore", "verifying there is no more tweets");
        await this.scrollToBottom();

        // Record the current number of tweets, retweets, and likes
        const currentTweetsIndexed = this.progress.tweetsIndexed;
        const currentRetweetsIndexed = this.progress.retweetsIndexed;
        const currentLikesIndexed = this.progress.likesIndexed;
        const currentUnknownIndex = this.progress.unknownIndexed;

        // Reset the thereIsMore flag
        await window.electron.X.resetThereIsMore(this.account?.id);

        // Try to trigger more API requests by scrolling up and down
        await this.sleep(500);
        await this.scrollUp(2000);
        await this.sleep(1500);
        await this.scrollToBottom();
        await this.sleep(1500);

        // Parse so far
        this.progress = await window.electron.X.indexParseTweets(this.account?.id);
        this.log("indexTweetsVerifyThereIsNoMore", ["parsed tweets", this.progress]);

        // Check if we're done again
        if (!await window.electron.X.indexIsThereMore(this.account?.id)) {
            this.log("indexTweetsVerifyThereIsNoMore", "got the final API response again, so we are done");
            return true;
        }

        // It's also possible that the final API response did not load, in which case we can see if the
        // progress was updated. If it was not, we're done.
        if (
            this.progress.tweetsIndexed == currentTweetsIndexed &&
            this.progress.retweetsIndexed == currentRetweetsIndexed &&
            this.progress.likesIndexed == currentLikesIndexed &&
            this.progress.unknownIndexed == currentUnknownIndex
        ) {
            this.log("indexTweetsVerifyThereIsNoMore", "the progress was not updated, we are done");
            return true;
        }

        this.log("indexTweetsVerifyThereIsNoMore", "we are not done, good thing we checked");
        return false;
    }

    async login() {
        const originalUsername = this.account && this.account?.xAccount && this.account?.xAccount.username ? this.account?.xAccount.username : null;

        this.showBrowser = true;

        this.log("login", "logging in");

        // Load the login page and wait for it to redirect to home
        await this.loadURLWithRateLimit("https://x.com/login", ["https://x.com/home", "https://x.com/i/flow/login"]);
        try {
            await this.waitForURL("https://x.com/home");
        } catch (e) {
            if (e instanceof URLChangedError) {
                await this.error(AutomationErrorType.X_login_URLChanged, {
                    exception: (e as Error).toString()
                }, {
                    currentURL: this.webview?.getURL()
                });
            } else {
                await this.error(AutomationErrorType.X_login_WaitingForURLFailed, {
                    exception: (e as Error).toString()
                }, {
                    currentURL: this.webview?.getURL()
                });
            }
        }

        // We're logged in
        this.log("login", "login succeeded");
        this.showAutomationNotice = true;

        // If this is the first time we're logging in, track it
        if (this.state === State.Login) {
            await window.electron.trackEvent(PlausibleEvents.X_USER_SIGNED_IN, navigator.userAgent);
        }

        await this.waitForPause();

        // Load home
        this.log("login", "getting username");
        this.instructions = `I'm discovering your username...`;
        if (this.webview?.getURL() != "https://x.com/home") {
            await this.loadURLWithRateLimit("https://x.com/home");
        }

        // See if cookie overlay is present, and if so click "Refuse non-essential cookies"
        if (await this.doesSelectorExist('div[data-testid="BottomBar"]')) {
            await this.scriptClickElementWithinElementLast('div[data-testid="BottomBar"]', 'button');
            await this.sleep(500);
            await this.scriptClickElementWithinElementLast('div[data-testid="BottomBar"]', 'button');
        }

        // Wait for profile button to appear, and click it
        await this.waitForSelector('a[data-testid="AppTabBar_Profile_Link"]', "https://x.com/home");
        await this.scriptClickElement('a[data-testid="AppTabBar_Profile_Link"]');

        // Wait for profile page to load, and get the username from the URL
        await this.waitForSelector('div[data-testid="UserName"]');
        const url = this.webview?.getURL() || '';
        const urlObj = new URL(url);
        const username = urlObj.pathname.substring(1);

        if (originalUsername !== null && username != originalUsername) {
            this.log("login", `username changed from ${this.account?.xAccount?.username} to ${username}`);
            // TODO: username changed error
            console.error(`Username changed from ${originalUsername} to ${username}!`);
            return;
        }

        // Save the username
        if (this.account && this.account?.xAccount && username) {
            this.account.xAccount.username = username;
        }
        await window.electron.database.saveAccount(JSON.stringify(this.account));
        this.log("login", "saved username");

        await this.waitForPause();

        // Get the profile image
        this.log("login", "getting profile image");
        this.instructions = `You're logged in as **@${username}**. I'm downloading your profile image...`;

        await this.loadURLWithRateLimit(`https://x.com/${username}/photo`);
        await this.waitForSelector('div[data-testid="swipe-to-dismiss"]', `https://x.com/${username}/photo`);

        const profileImageURL = await this.getWebview()?.executeJavaScript(`document.querySelector('div[data-testid="swipe-to-dismiss"]').querySelector('img').src`);
        await window.electron.X.saveProfileImage(this.account?.id, profileImageURL);
        this.log("login", ["saved profile image", profileImageURL]);

        await this.waitForPause();
    }

    async loadUserStats() {
        this.log("loadUserStats", "loading user stats");
        this.showBrowser = true;
        this.showAutomationNotice = true;

        // Start monitoring network requests so we can detect all.json, which should include user stats like tweet count, like count, etc.
        await window.electron.X.indexStart(this.account?.id);

        // Load notifications
        this.log("login", "getting user stats");
        this.instructions = `I'm trying to determine your total tweets and likes, according to X...`;

        await this.loadURLWithRateLimit('https://x.com/home');
        await this.loadURLWithRateLimit('https://x.com/notifications');
        try {
            await this.waitForSelector('div[data-testid="primaryColumn"]', 'https://x.com/notifications', 5000);
        } catch (e) {
            this.log("loadUserStats", ["selector never appeared", e]);
        }
        await this.sleep(3000);

        // Stop monitoring network requests
        await window.electron.X.indexStop(this.account?.id);

        // Get user stats
        const account: XAccount = await window.electron.X.indexParseAllJSON(this.account?.id);
        this.account.xAccount = account;
        this.emitter?.emit("account-updated");

        this.log("loadUserStats", `${account.tweetsCount} tweets, ${account.likesCount} likes, ${account.followingCount} following, ${account.followersCount} followers`);

        await window.electron.X.setConfig(this.account?.id, 'reloadUserStats', 'false');

        await this.waitForPause();
    }

    async finishJob(jobIndex: number) {
        const finishedAt = new Date();
        this.jobs[jobIndex].finishedAt = finishedAt;
        this.jobs[jobIndex].status = "finished";
        this.jobs[jobIndex].progressJSON = JSON.stringify(this.progress);
        await window.electron.X.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));
        await window.electron.X.setConfig(
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
        await window.electron.X.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));
        this.log("errorJob", this.jobs[jobIndex].jobType);
    }

    // Load the DMs page, and return true if an error was triggered
    async deleteDMsLoadDMsPage(): Promise<boolean> {
        this.log("deleteDMsLoadDMsPage", "loading DMs page");
        let tries: number, success: boolean;
        let error: Error | null = null;
        let errorType: AutomationErrorType = AutomationErrorType.x_runJob_deleteDMs_OtherError;
        let newURL: string = "";

        success = false;
        for (tries = 0; tries < 3; tries++) {
            await this.loadURLWithRateLimit("https://x.com/messages");

            // If the conversations list is empty, there is no search text field
            try {
                // Wait for the search text field to appear with a 2 second timeout
                await this.waitForSelector('section input[type="text"]', "https://x.com/messages", 2000);
            } catch (e) {
                // There are no conversations
                await this.waitForLoadingToFinish();
                this.progress.isDeleteDMsFinished = true;
                await this.syncProgress();
                return false;
            }

            try {
                await window.electron.X.resetRateLimitInfo(this.account?.id);
                this.log("deleteDMsLoadDMsPage", "waiting for selector after loading messages page");
                await this.waitForSelector('section div div[role="tablist"] div[data-testid="cellInnerDiv"]', "https://x.com/messages");
                success = true;
                break;
            } catch (e) {
                this.log("deleteDMsLoadDMsPage", ["selector never appeared", e]);
                if (e instanceof TimeoutError) {
                    // Were we rate limited?
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                    } else {
                        // Assume that there are no conversations
                        await this.waitForLoadingToFinish();
                        this.progress.isDeleteDMsFinished = true;
                        await this.syncProgress();
                        return false;
                    }
                } else if (e instanceof URLChangedError) {
                    newURL = this.webview?.getURL() || '';
                    error = e;
                    errorType = AutomationErrorType.x_runJob_deleteDMs_URLChanged;
                    this.log("deleteDMsLoadDMsPage", ["URL changed", newURL]);
                    await this.sleep(1000);
                    continue;
                } else {
                    error = e as Error
                    this.log("deleteDMsLoadDMsPage", ["other error", e]);
                    await this.sleep(1000);
                    continue;
                }
            }
        }

        if (!success) {
            await this.error(errorType, {
                exception: (error as Error).toString(),
                currentURL: this.webview?.getURL(),
                newURL: newURL,
            })
            return true;
        }

        return false;
    }

    // Load the following page, and return true if an error was triggered
    async unfollowEveryoneLoadPage(): Promise<boolean> {
        this.log("unfollowEveryoneLoadPage", "loading following page");
        let tries: number, success: boolean;
        let error: Error | null = null;
        let errorType: AutomationErrorType = AutomationErrorType.x_runJob_unfollowEveryone_OtherError;
        let newURL: string = "";

        const followingURL = `https://x.com/${this.account?.xAccount?.username}/following`;

        success = false;
        for (tries = 0; tries < 3; tries++) {
            await this.loadURLWithRateLimit(followingURL);

            // If no following users appear in two seconds, there are no following users
            try {
                await this.waitForSelector('div[data-testid="cellInnerDiv"] button button', followingURL, 2000);
            } catch (e) {
                if (e instanceof TimeoutError) {
                    // Were we rate limited?
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                    } else {
                        // There are no following users
                        await this.waitForLoadingToFinish();
                        this.progress.isUnfollowEveryoneFinished = true;
                        await this.syncProgress();
                        return false;
                    }
                } else if (e instanceof URLChangedError) {
                    newURL = this.webview?.getURL() || '';
                    error = e;
                    errorType = AutomationErrorType.x_runJob_deleteDMs_URLChanged;
                    this.log("unfollowEveryoneLoadPage", ["URL changed", newURL]);
                    await this.sleep(1000);
                    continue;
                } else {
                    error = e as Error
                    this.log("unfollowEveryoneLoadPage", ["other error", e]);
                    await this.sleep(1000);
                    continue;
                }
            }

            success = true;
            break;
        }

        if (!success) {
            await this.error(errorType, {
                exception: (error as Error).toString(),
                currentURL: this.webview?.getURL(),
                newURL: newURL,
            })
            return true;
        }

        return false;
    }

    async archiveSaveTweet(outputPath: string, tweetItem: XTweetItem): Promise<boolean> {
        this.log("archiveSaveTweet", `Archiving ${tweetItem.basename}`);

        // Check if the tweet is already archived
        if (await window.electron.archive.isPageAlreadySaved(outputPath, tweetItem.basename)) {
            this.log("archiveSaveTweet", `Already archived ${tweetItem.basename}`);
            await window.electron.X.archiveTweetCheckDate(this.account?.id, tweetItem.tweetID);
            this.progress.tweetsArchived += 1;
            return true;
        }

        // Load the URL
        await this.loadURLWithRateLimit(tweetItem.url);

        // Check if tweet is already deleted
        let alreadyDeleted = false;
        await this.sleep(200);
        if (await this.doesSelectorExist('div[data-testid="primaryColumn"] div[data-testid="error-detail"]')) {
            this.log("archiveSaveTweet", "tweet is already deleted");
            alreadyDeleted = true;
        }

        // Wait for the tweet to appear
        if (!alreadyDeleted) {
            try {
                await this.waitForSelector('article[tabindex="-1"]', tweetItem.url, 10000);
                // Wait another second for replies, etc. to load
                await this.sleep(1000);
            } catch (e) {
                this.log("archiveSaveTweet", ["selector never appeared, but saving anyway", e]);
            }
        }

        // Save the page
        if (this.webContentsID) {
            await window.electron.archive.savePage(this.webContentsID, outputPath, tweetItem.basename);
        } else {
            this.error(AutomationErrorType.x_runJob_archiveTweets_FailedToArchive, {
                message: "webContentsID is null"
            }, {
                currentURL: this.webview?.getURL()
            });
            return false;
        }

        // Update tweet's archivedAt date
        try {
            await window.electron.X.archiveTweet(this.account?.id, tweetItem.tweetID);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_archiveTweets_FailedToArchive, {
                exception: (e as Error).toString()
            }, {
                tweetItem: tweetItem,
                currentURL: this.webview?.getURL()
            })
            return false;
        }

        // Update progress
        this.progress.tweetsArchived += 1;
        this.progress.newTweetsArchived += 1;
        return true;
    }

    async getDatabaseStatsString(): Promise<string> {
        await this.refreshDatabaseStats();
        const tweetsCount = this.databaseStats.tweetsSaved - this.databaseStats.tweetsDeleted;
        const retweetsCount = this.databaseStats.retweetsSaved - this.databaseStats.retweetsDeleted;
        const likesCount = this.databaseStats.likesSaved - this.databaseStats.likesDeleted;

        const statsComponents = [];
        if (this.account?.xAccount?.deleteTweets) {
            statsComponents.push(`${tweetsCount.toLocaleString()} tweets`);
        }
        if (this.account?.xAccount?.deleteRetweets) {
            statsComponents.push(`${retweetsCount.toLocaleString()} retweets`);
        }
        if (this.account?.xAccount?.deleteLikes) {
            statsComponents.push(`${likesCount.toLocaleString()} likes`);
        }

        let statsString = "";
        for (let i = 0; i < statsComponents.length; i++) {
            statsString += statsComponents[i];
            if (i < statsComponents.length - 2) {
                statsString += ", ";
            } else if (i < statsComponents.length - 1) {
                statsString += " and ";
            }
        }
        return statsString;
    }

    async runJobLogin(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_LOGIN, navigator.userAgent);

        this.showBrowser = true;
        this.instructions = `Checking to see if you're still logged in to your X account...`;

        this.showAutomationNotice = false;
        await this.login();

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobIndexTweets(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_INDEX_TWEETS, navigator.userAgent);

        this.showBrowser = true;
        this.instructions = `**I'm saving your tweets.**

Hang on while I scroll down to your earliest tweets.`;
        this.showAutomationNotice = true;

        // Start monitoring network requests
        await this.loadBlank();
        await window.electron.X.indexStart(this.account?.id);
        await this.sleep(2000);

        // Start the progress
        this.progress.isIndexTweetsFinished = false;
        this.progress.tweetsIndexed = 0;
        await this.syncProgress();

        await window.electron.X.resetRateLimitInfo(this.account?.id);

        // Load the timeline
        let errorTriggered = false;
        await this.loadURLWithRateLimit("https://x.com/" + this.account?.xAccount?.username + "/with_replies");
        await this.sleep(500);

        // Check if tweets list is empty
        if (await this.doesSelectorExist('section')) {
            if (await this.countSelectorsFound('section article') == 0) {
                // There are no tweets
                this.log("runJobIndexTweets", "no tweets found");
                this.progress.isIndexTweetsFinished = true;
                this.progress.tweetsIndexed = 0;
                await this.syncProgress();
            }
        }

        if (!this.progress.isIndexTweetsFinished) {
            // Wait for tweets to appear
            try {
                await this.waitForSelector('article', "https://x.com/" + this.account?.xAccount?.username + "/with_replies");
            } catch (e) {
                this.log("runJobIndexTweets", ["selector never appeared", e]);
                if (e instanceof TimeoutError) {
                    // Were we rate limited?
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                    } else {
                        // If the page isn't loading, we assume the user has no conversations yet
                        await this.waitForLoadingToFinish();
                        this.progress.isIndexTweetsFinished = true;
                        this.progress.tweetsIndexed = 0;
                        await this.syncProgress();
                    }
                } else if (e instanceof URLChangedError) {
                    const newURL = this.webview?.getURL();
                    await this.error(AutomationErrorType.x_runJob_indexTweets_URLChanged, {
                        newURL: newURL,
                        exception: (e as Error).toString()
                    }, {
                        currentURL: this.webview?.getURL()
                    })
                    errorTriggered = true;
                } else {
                    await this.error(AutomationErrorType.x_runJob_indexTweets_OtherError, {
                        exception: (e as Error).toString()
                    }, {
                        currentURL: this.webview?.getURL()
                    })
                    errorTriggered = true;
                }
            }
        }

        if (errorTriggered) {
            return false;
        }

        errorTriggered = false;
        while (this.progress.isIndexTweetsFinished === false) {
            await this.waitForPause();

            // Scroll to bottom
            await window.electron.X.resetRateLimitInfo(this.account?.id);
            let moreToScroll = await this.scrollToBottom();

            // Check for rate limit
            this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
            if (this.rateLimitInfo.isRateLimited) {
                this.log("runJobIndexTweets", ["rate limited", this.progress]);

                // Scroll down more to see the retry button
                await this.sleep(500);
                await this.scrollToBottom();
                await this.waitForRateLimit();

                // Try to handle the rate limit
                if (!await this.indexTweetsHandleRateLimit()) {
                    // On fail, update the failure state and move on
                    await window.electron.X.setConfig(this.account?.id, FailureState.indexTweets_FailedToRetryAfterRateLimit, "true");
                    break;
                }

                await this.sleep(500);
                moreToScroll = true;

                // Continue on the next iteration of the infinite loop.
                this.log("runJobIndexTweets", ["finished waiting for rate limit"]);
                continue;
            }

            // Parse so far
            try {
                this.progress = await window.electron.X.indexParseTweets(this.account?.id);
                this.log("runJobIndexTweets", ["parsed tweets", this.progress]);
            } catch (e) {
                const latestResponseData = await window.electron.X.getLatestResponseData(this.account?.id);
                await this.error(AutomationErrorType.x_runJob_indexTweets_ParseTweetsError, {
                    exception: (e as Error).toString()
                }, {
                    latestResponseData: latestResponseData,
                    currentURL: this.webview?.getURL()
                });
                errorTriggered = true;
                break;
            }
            this.jobs[jobIndex].progressJSON = JSON.stringify(this.progress);
            await window.electron.X.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));

            // Check if we're done
            if (!await window.electron.X.indexIsThereMore(this.account?.id)) {

                // Verify that we're actually done
                let verifyResult = true;
                try {
                    verifyResult = await this.indexTweetsVerifyThereIsNoMore();
                } catch (e) {
                    const latestResponseData = await window.electron.X.getLatestResponseData(this.account?.id);
                    await this.error(AutomationErrorType.x_runJob_indexTweets_VerifyThereIsNoMoreError, {
                        exception: (e as Error).toString()
                    }, {
                        latestResponseData: latestResponseData,
                        currentURL: this.webview?.getURL()
                    });
                    errorTriggered = true;
                    break;
                }

                // If we verified that there are no more tweets, we're done
                if (verifyResult) {
                    this.progress = await window.electron.X.indexTweetsFinished(this.account?.id);

                    // On success, set the failure state to false
                    await window.electron.X.setConfig(this.account?.id, FailureState.indexTweets_FailedToRetryAfterRateLimit, "fail");
                    break;
                }

                // Otherwise, update the job and keep going
                this.jobs[jobIndex].progressJSON = JSON.stringify(this.progress);
                await window.electron.X.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));

            } else {
                if (!moreToScroll) {
                    // We scrolled to the bottom but we're not finished, so scroll up a bit to trigger infinite scroll next time
                    await this.sleep(500);
                    await this.scrollUp(2000);
                }
            }

            // Check if there is a "Something went wrong" message
            await this.indexTweetsCheckForSomethingWrong();
        }

        // Stop monitoring network requests
        await window.electron.X.indexStop(this.account?.id);

        if (errorTriggered) {
            return false;
        }

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobArchiveTweets(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_ARCHIVE_TWEETS, navigator.userAgent);

        let archiveStartResponse: XArchiveStartResponse;

        this.showBrowser = true;
        this.instructions = `**I'm download HTML copies of your tweets, starting with the oldest.**

This may take a while...`;
        this.showAutomationNotice = true;

        // Initialize archiving of tweets
        try {
            archiveStartResponse = await window.electron.X.archiveTweetsStart(this.account?.id);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_archiveTweets_FailedToStart, {
                exception: (e as Error).toString()
            })
            return false;
        }
        this.log('runJob', ["jobType=archiveTweets", "archiveStartResponse", archiveStartResponse]);

        // Start the progress
        this.progress.totalTweetsToArchive = archiveStartResponse.items.length;
        this.progress.tweetsArchived = 0;
        this.progress.newTweetsArchived = 0;

        // Archive the tweets
        let errorTriggered = false;
        for (let i = 0; i < archiveStartResponse.items.length; i++) {
            await this.waitForPause();

            // Save the tweet
            if (!await this.archiveSaveTweet(archiveStartResponse.outputPath, archiveStartResponse.items[i])) {
                errorTriggered = true;
                break;
            }
        }

        if (errorTriggered) {
            return false;
        }

        await this.syncProgress();
        await this.finishJob(jobIndex);
        return true;
    }

    async runJobIndexConversations(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_INDEX_CONVERSATIONS, navigator.userAgent);

        this.showBrowser = true;
        this.instructions = `**I'm saving your direct message conversations.**

Hang on while I scroll down to your earliest direct message conversations...`;
        this.showAutomationNotice = true;

        // Start monitoring network requests
        await this.loadBlank();
        await window.electron.X.indexStart(this.account?.id);
        await this.sleep(2000);

        let errorTriggered = false;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            await this.waitForPause();
            await window.electron.X.resetRateLimitInfo(this.account?.id);

            // Load the messages page
            await this.loadURLWithRateLimit("https://x.com/messages");

            // If the conversations list is empty, there is no search text field
            try {
                // Wait for the search text field to appear with a 2 second timeout
                await this.waitForSelector('section input[type="text"]', "https://x.com/messages", 2000);
            } catch (e) {
                // There are no conversations
                await this.waitForLoadingToFinish();
                this.progress.isIndexConversationsFinished = true;
                this.progress.conversationsIndexed = 0;
                await this.syncProgress();
                break;
            }

            // Wait for conversations to appear
            try {
                await this.waitForSelector('section div div[role="tablist"] div[data-testid="cellInnerDiv"]', "https://x.com/messages");
                break;
            } catch (e) {
                this.log("runJobIndexConversations", ["selector never appeared", e]);
                if (e instanceof TimeoutError) {
                    // Were we rate limited?
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                    } else {
                        // Assume that there are no conversations
                        await this.waitForLoadingToFinish();
                        this.progress.isIndexConversationsFinished = true;
                        this.progress.conversationsIndexed = 0;
                        await this.syncProgress();
                        break;
                    }
                } else if (e instanceof URLChangedError) {
                    const newURL = this.webview?.getURL();
                    await this.error(AutomationErrorType.x_runJob_indexConversations_URLChanged, {
                        newURL: newURL,
                        exception: (e as Error).toString(),
                        currentURL: this.webview?.getURL()
                    })
                    errorTriggered = true;
                } else {
                    await this.error(AutomationErrorType.x_runJob_indexConversations_OtherError, {
                        exception: (e as Error).toString(),
                        currentURL: this.webview?.getURL()
                    })
                    errorTriggered = true;
                }
            }
        }

        if (errorTriggered) {
            return false;
        }

        while (this.progress.isIndexConversationsFinished === false) {
            await this.waitForPause();

            // Scroll to bottom
            await window.electron.X.resetRateLimitInfo(this.account?.id);
            const moreToScroll = await this.scrollToBottom();
            this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
            if (this.rateLimitInfo.isRateLimited) {
                await this.waitForRateLimit();
            }

            // Parse so far
            try {
                this.progress = await window.electron.X.indexParseConversations(this.account?.id);
            } catch (e) {
                const latestResponseData = await window.electron.X.getLatestResponseData(this.account?.id);
                await this.error(AutomationErrorType.x_runJob_indexConversations_ParseConversationsError, {
                    exception: (e as Error).toString()
                }, {
                    latestResponseData: latestResponseData
                });
                errorTriggered = true;
                break;
            }
            this.jobs[jobIndex].progressJSON = JSON.stringify(this.progress);
            await window.electron.X.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));

            // Check if we're done
            if (!await window.electron.X.indexIsThereMore(this.account?.id)) {
                this.progress = await window.electron.X.indexConversationsFinished(this.account?.id);
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
        await window.electron.X.indexStop(this.account?.id);

        if (errorTriggered) {
            return false;
        }

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobIndexMessages(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_INDEX_MESSAGES, navigator.userAgent);

        let tries: number, success: boolean, error: null | Error = null;

        let indexMessagesStartResponse: XIndexMessagesStartResponse;
        let url = '';

        this.showBrowser = true;
        this.instructions = `**I'm saving your direct messages.**

Please wait while I index all the messages from each conversation...`;
        this.showAutomationNotice = true;

        // Start monitoring network requests
        await this.loadBlank();
        await window.electron.X.indexStart(this.account?.id);
        await this.sleep(2000);

        // Load the conversations
        try {
            indexMessagesStartResponse = await window.electron.X.indexMessagesStart(this.account?.id);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_indexMessages_FailedToStart, {
                exception: (e as Error).toString()
            })
            return false;
        }
        this.log('runJobIndexMessages', ["indexMessagesStartResponse", indexMessagesStartResponse]);

        // Start the progress
        this.progress.totalConversations = indexMessagesStartResponse?.totalConversations;
        this.progress.conversationMessagesIndexed = this.progress.totalConversations - indexMessagesStartResponse?.conversationIDs.length;
        await this.syncProgress();

        let errorTriggered = false;
        for (let i = 0; i < indexMessagesStartResponse.conversationIDs.length; i++) {
            await this.waitForPause();

            // Load the URL
            success = false;
            let shouldSkip = false;
            for (tries = 0; tries < 3; tries++) {
                await this.waitForPause();

                // Load URL and wait for messages to appear
                try {
                    url = `https://x.com/messages/${indexMessagesStartResponse.conversationIDs[i]}`;
                    await this.loadURLWithRateLimit(url);
                    await this.waitForSelector('div[data-testid="DmActivityContainer"]', url);
                    success = true;
                    break;
                } catch (e) {
                    this.log("runJobIndexMessages", ["selector never appeared", e]);
                    if (e instanceof TimeoutError) {
                        // Were we rate limited?
                        this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                        if (this.rateLimitInfo.isRateLimited) {
                            await this.waitForRateLimit();
                        } else {
                            error = e;
                            this.log("runJobIndexMessages", ["loading conversation and waiting for messages failed, try #", tries]);
                            await this.sleep(1000);
                        }
                    } else if (e instanceof URLChangedError) {
                        // If the URL changes (like to https://x.com/i/verified-get-verified), skip it
                        this.log("runJobIndexMessages", ["conversation is inaccessible, so skipping it"]);
                        this.progress.conversationMessagesIndexed += 1;
                        await this.syncProgress();
                        shouldSkip = true;
                        success = true;

                        // Mark the conversation's shouldIndexMessages to false
                        await window.electron.X.indexConversationFinished(this.account?.id, indexMessagesStartResponse.conversationIDs[i]);
                        break;
                    } else {
                        error = e as Error;
                        this.log("runJobIndexMessages", ["loading conversation and waiting for messages failed, try #", tries]);
                        await this.sleep(1000);
                    }
                }
            }

            if (!success) {
                await this.error(AutomationErrorType.x_runJob_indexMessages_Timeout, {
                    exception: (error as Error).toString(),
                });
                errorTriggered = true;
            }

            if (shouldSkip) {
                continue;
            }

            if (errorTriggered) {
                await window.electron.X.indexStop(this.account?.id);
                break;
            }

            await this.sleep(500);
            await this.waitForLoadingToFinish();

            while (this.progress.isIndexMessagesFinished === false) {
                await this.waitForPause();

                // Scroll to top
                await window.electron.X.resetRateLimitInfo(this.account?.id);
                let moreToScroll = await this.scrollToTop('div[data-testid="DmActivityViewport"]');
                this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                if (this.rateLimitInfo.isRateLimited) {
                    await this.waitForRateLimit();
                    moreToScroll = true;
                }

                // Parse so far
                try {
                    this.progress = await window.electron.X.indexParseMessages(this.account?.id);
                } catch (e) {
                    const latestResponseData = await window.electron.X.getLatestResponseData(this.account?.id);
                    await this.error(AutomationErrorType.x_runJob_indexMessages_ParseMessagesError, {
                        exception: (e as Error).toString()
                    }, {
                        latestResponseData: latestResponseData,
                        currentURL: this.webview?.getURL()
                    });
                    errorTriggered = true;
                    break;
                }
                this.jobs[jobIndex].progressJSON = JSON.stringify(this.progress);
                await window.electron.X.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));

                // Check if we're done
                if (!moreToScroll) {
                    this.progress.conversationMessagesIndexed += 1;
                    await this.syncProgress();
                    break;
                }
            }

            // Mark the conversation's shouldIndexMessages to false
            await window.electron.X.indexConversationFinished(this.account?.id, indexMessagesStartResponse.conversationIDs[i]);
        }

        // Stop monitoring network requests
        await window.electron.X.indexStop(this.account?.id);

        if (errorTriggered) {
            return false;
        }

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobArchiveBuild(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_ARCHIVE_BUILD, navigator.userAgent);

        this.showBrowser = false;
        this.instructions = `**I'm building a searchable archive web page in HTML.**`;
        this.showAutomationNotice = true;

        // Build the archive
        try {
            await window.electron.X.archiveBuild(this.account?.id);
            this.emitter?.emit(`x-update-archive-info-${this.account?.id}`);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_archiveBuild_ArchiveBuildError, {
                exception: (e as Error).toString()
            })
            return false;
        }

        // Submit progress to the API
        this.emitter?.emit(`x-submit-progress-${this.account?.id}`);

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobIndexLikes(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_INDEX_LIKES, navigator.userAgent);

        this.showBrowser = true;
        this.instructions = `**I'm saving your likes.**

Hang on while I scroll down to your earliest likes.`;
        this.showAutomationNotice = true;

        // Start monitoring network requests
        await this.loadBlank();
        await window.electron.X.indexStart(this.account?.id);
        await this.sleep(2000);

        // Start the progress
        this.progress.isIndexLikesFinished = false;
        this.progress.likesIndexed = 0;
        await this.syncProgress();

        // Load the likes
        let errorTriggered = false;
        await this.waitForPause();
        await window.electron.X.resetRateLimitInfo(this.account?.id);
        await this.loadURLWithRateLimit("https://x.com/" + this.account?.xAccount?.username + "/likes");

        // Check if likes list is empty
        if (await this.doesSelectorExist('div[data-testid="emptyState"]')) {
            this.log("runJobIndexLikes", "no likes found");
            this.progress.isIndexLikesFinished = true;
            this.progress.likesIndexed = 0;
            await this.syncProgress();
        }

        if (!this.progress.isIndexLikesFinished) {
            // Wait for tweets to appear
            try {
                await this.waitForSelector('article', "https://x.com/" + this.account?.xAccount?.username + "/likes");
            } catch (e) {
                this.log("runJobIndexLikes", ["selector never appeared", e]);
                if (e instanceof TimeoutError) {
                    // Were we rate limited?
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                    } else {
                        // If the page isn't loading, we assume the user has no likes yet
                        await this.waitForLoadingToFinish();
                        this.progress.isIndexLikesFinished = true;
                        this.progress.likesIndexed = 0;
                        await this.syncProgress();
                    }
                } else if (e instanceof URLChangedError) {
                    const newURL = this.webview?.getURL();
                    await this.error(AutomationErrorType.x_runJob_indexLikes_URLChanged, {
                        newURL: newURL,
                        exception: (e as Error).toString()
                    })
                    errorTriggered = true;
                } else {
                    await this.error(AutomationErrorType.x_runJob_indexLikes_OtherError, {
                        exception: (e as Error).toString()
                    })
                    errorTriggered = true;
                }
            }
        }

        if (errorTriggered) {
            await window.electron.X.indexStop(this.account?.id);
            return false;
        }

        while (this.progress.isIndexLikesFinished === false) {
            await this.waitForPause();

            // Scroll to bottom
            await window.electron.X.resetRateLimitInfo(this.account?.id);
            let moreToScroll = await this.scrollToBottom();
            this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
            if (this.rateLimitInfo.isRateLimited) {
                await this.sleep(500);
                await this.scrollToBottom();
                await this.waitForRateLimit();
                if (!await this.indexTweetsHandleRateLimit()) {
                    // On fail, update the failure state and move on
                    await window.electron.X.setConfig(this.account?.id, FailureState.indexLikes_FailedToRetryAfterRateLimit, "true");
                    break;
                }
                await this.sleep(500);
                moreToScroll = true;
            }

            // Parse so far
            try {
                this.progress = await window.electron.X.indexParseLikes(this.account?.id);
            } catch (e) {
                const latestResponseData = await window.electron.X.getLatestResponseData(this.account?.id);
                await this.error(AutomationErrorType.x_runJob_indexLikes_ParseTweetsError, {
                    exception: (e as Error).toString()
                }, {
                    latestResponseData: latestResponseData
                });
                errorTriggered = true;
                break;
            }
            this.jobs[jobIndex].progressJSON = JSON.stringify(this.progress);
            await window.electron.X.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));

            // Check if we're done
            if (!await window.electron.X.indexIsThereMore(this.account?.id)) {

                // Verify that we're actually done
                let verifyResult = true;
                try {
                    verifyResult = await this.indexTweetsVerifyThereIsNoMore();
                } catch (e) {
                    const latestResponseData = await window.electron.X.getLatestResponseData(this.account?.id);
                    await this.error(AutomationErrorType.x_runJob_indexLikes_VerifyThereIsNoMoreError, {
                        exception: (e as Error).toString()
                    }, {
                        latestResponseData: latestResponseData,
                        currentURL: this.webview?.getURL()
                    });
                    errorTriggered = true;
                    break;
                }

                // If we verified that there are no more tweets, we're done
                if (verifyResult) {
                    this.progress = await window.electron.X.indexLikesFinished(this.account?.id);

                    // On success, set the failure state to false
                    await window.electron.X.setConfig(this.account?.id, FailureState.indexLikes_FailedToRetryAfterRateLimit, "fail");
                    break;
                }

                // Otherwise, update the job and keep going
                this.jobs[jobIndex].progressJSON = JSON.stringify(this.progress);
                await window.electron.X.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));

            } else {
                if (!moreToScroll) {
                    // We scrolled to the bottom but we're not finished, so scroll up a bit to trigger infinite scroll next time
                    await this.sleep(500);
                    await this.scrollUp(1000);
                }
            }

            // Check if there is a "Something went wrong" message
            await this.indexTweetsCheckForSomethingWrong();
        }

        // Stop monitoring network requests
        await window.electron.X.indexStop(this.account?.id);

        if (errorTriggered) {
            return false;
        }

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobDeleteTweets(jobIndex: number) {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_DELETE_TWEETS, navigator.userAgent);

        // After this job, we want to reload the user stats
        await window.electron.X.setConfig(this.account?.id, 'reloadUserStats', 'true');

        let tries: number, success: boolean;
        let error: Error | null = null;
        let errorType: AutomationErrorType = AutomationErrorType.x_runJob_deleteTweets_UnknownError;

        let tweetsToDelete: XDeleteTweetsStartResponse;

        this.showBrowser = true;
        this.instructions = `**I'm deleting your tweets based on your criteria, starting with the earliest.**`;
        this.showAutomationNotice = true;

        // Load the tweets to delete
        try {
            tweetsToDelete = await window.electron.X.deleteTweetsStart(this.account?.id);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_deleteTweets_FailedToStart, {
                exception: (e as Error).toString()
            })
            return false;
        }
        this.log('runJob', ["jobType=deleteTweets", "deleteTweetsStartResponse", tweetsToDelete]);

        // Start the progress
        this.progress.totalTweetsToDelete = tweetsToDelete.tweets.length;
        this.progress.tweetsDeleted = 0;
        this.progress.tweetsArchived = 0;
        this.progress.newTweetsArchived = 0;
        await this.syncProgress();

        let errorTriggered = false;
        for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
            errorType = AutomationErrorType.x_runJob_deleteTweets_UnknownError;

            success = false;
            for (tries = 0; tries < 3; tries++) {
                // Load the URL
                await this.loadURLWithRateLimit(
                    `https://x.com/${this.account?.xAccount?.username}/status/${tweetsToDelete.tweets[i].tweetID}`,
                    // It's okay if the URL changes as long as the tweetID is the same
                    // This happens if the user has changed their username
                    [RegExp(`https://x\\.com/.*/status/${tweetsToDelete.tweets[i].tweetID}`)]
                );
                await this.sleep(200);

                await this.waitForPause();

                // Check if tweet is already deleted
                if (await this.doesSelectorExist('div[data-testid="primaryColumn"] div[data-testid="error-detail"]')) {
                    this.log("runJobDeleteTweets", ["tweet is already deleted", tweetsToDelete.tweets[i].tweetID]);
                    success = true;
                    break;
                }

                if (this.account?.xAccount?.deleteTweetsArchiveEnabled) {
                    // Archive the tweet
                    if (!await this.archiveSaveTweet(await window.electron.X.archiveTweetsOutputPath(this.account?.id), tweetsToDelete.tweets[i])) {
                        errorType = AutomationErrorType.x_runJob_deleteTweets_FailedToArchive;
                        errorTriggered = true;
                        continue;
                    }
                }

                await this.waitForPause();

                // Wait for the menu button to appear
                try {
                    await this.waitForSelector('article[tabindex="-1"] button[data-testid="caret"]');
                } catch (e) {
                    error = e as Error;
                    errorType = AutomationErrorType.x_runJob_deleteTweets_WaitForMenuButtonFailed;
                    this.log("runJobDeleteTweets", ["wait for menu button to appear failed, try #", tries]);
                    await this.sleep(1000);
                    continue;
                }
                await this.sleep(200);

                // Click the menu button
                await this.scriptClickElement('article[tabindex="-1"] button[data-testid="caret"]');

                // Wait for the menu to appear
                try {
                    await this.waitForSelector('div[role="menu"] div[role="menuitem"]:first-of-type');
                } catch (e) {
                    error = e as Error;
                    errorType = AutomationErrorType.x_runJob_deleteTweets_WaitForMenuFailed;
                    this.log("runJobDeleteTweets", ["wait for menu to appear failed, try #", tries]);
                    await this.sleep(1000);
                    continue;
                }
                await this.sleep(200);

                // DEBUG: trigger an error instead
                error = null;
                errorType = AutomationErrorType.x_runJob_deleteTweets_UnknownError;
                errorTriggered = true;
                break;

                // Click the delete button
                await this.scriptClickElement('div[role="menu"] div[role="menuitem"]:first-of-type');

                // Wait for the delete confirmation popup to appear
                try {
                    await this.waitForSelector('div[role="group"] button[data-testid="confirmationSheetConfirm"]');
                } catch (e) {
                    error = e as Error;
                    errorType = AutomationErrorType.x_runJob_deleteTweets_WaitForDeleteConfirmationFailed;
                    this.log("runJobDeleteTweets", ["wait for delete confirmation popup to appear failed, try #", tries]);
                    await this.sleep(1000);
                    continue;
                }
                await this.sleep(200);

                // Click delete confirmation
                await this.scriptClickElement('div[role="group"] button[data-testid="confirmationSheetConfirm"]');
                await this.sleep(200);

                success = true;
                break;
            }

            if (errorTriggered) {
                // Record the error, with allowContinue=true, to continue on to the next tweet
                await this.error(errorType, {
                    exception: error ? (error as Error).toString() : 'null'
                }, {
                    tweet: tweetsToDelete.tweets[i],
                    index: i
                }, true);

                this.progress.errorsOccured += 1;
                await this.syncProgress();
            }

            if (success) {
                // Update the tweet's deletedAt date
                try {
                    await window.electron.X.deleteTweet(this.account?.id, tweetsToDelete.tweets[i].tweetID);
                } catch (e) {
                    await this.error(AutomationErrorType.x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp, {
                        exception: (e as Error).toString()
                    }, {
                        tweet: tweetsToDelete.tweets[i],
                        index: i
                    }, true)
                    errorTriggered = true;
                }

                this.progress.tweetsDeleted += 1;
                await this.syncProgress();
            }
        }

        await this.finishJob(jobIndex);
    }

    async runJobDeleteRetweets(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_DELETE_RETWEETS, navigator.userAgent);

        let tries: number, success: boolean;
        let error: Error | null = null;
        let errorType: AutomationErrorType = AutomationErrorType.x_runJob_deleteRetweets_UnknownError;

        let tweetsToDelete: XDeleteTweetsStartResponse;

        this.showBrowser = true;
        this.instructions = `**I'm deleting your retweets, starting with the earliest.**`;
        this.showAutomationNotice = true;
        let alreadyDeleted = false;

        // Load the retweets to delete
        try {
            tweetsToDelete = await window.electron.X.deleteRetweetsStart(this.account?.id);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_deleteTweets_FailedToStart, {
                exception: (e as Error).toString()
            })
            return false;
        }
        this.log('runJob', ["jobType=deleteRetweets", "deleteRetweetsStartResponse", tweetsToDelete]);

        // Start the progress
        this.progress.totalRetweetsToDelete = tweetsToDelete.tweets.length;
        this.progress.retweetsDeleted = 0;
        await this.syncProgress();

        let errorTriggered = false;
        for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
            errorType = AutomationErrorType.x_runJob_deleteRetweets_UnknownError;
            alreadyDeleted = false;

            success = false;
            for (tries = 0; tries < 3; tries++) {
                // Load the URL
                await this.loadURLWithRateLimit(
                    `https://x.com/${tweetsToDelete.tweets[i].username}/status/${tweetsToDelete.tweets[i].tweetID}`,
                    // It's okay if the URL changes as long as the tweetID is the same
                    // This happens if the user has changed their username
                    [RegExp(`https://x\\.com/.*/status/${tweetsToDelete.tweets[i].tweetID}`)]
                );
                await this.sleep(200);

                await this.waitForPause();

                // Check if retweet is already deleted
                if (await this.doesSelectorExist('div[data-testid="primaryColumn"] div[data-testid="error-detail"]')) {
                    this.log("runJobDeleteTweets", ["retweet is already deleted", tweetsToDelete.tweets[i].tweetID]);
                    alreadyDeleted = true;
                }

                if (!alreadyDeleted) {
                    // Wait for the retweet menu button to appear
                    try {
                        await this.waitForSelector('article[tabindex="-1"] button[data-testid="unretweet"]');
                    } catch (e) {
                        // If it doesn't appear, let's assume this retweet was already deleted and for some reason
                        // the previous check didn't catch it
                        alreadyDeleted = true;
                    }
                    await this.sleep(200);
                }

                if (!alreadyDeleted) {
                    // Click the retweet menu button
                    await this.scriptClickElement('article[tabindex="-1"] button[data-testid="unretweet"]');

                    // Wait for the unretweet menu to appear
                    try {
                        await this.waitForSelector('div[role="menu"] div[role="menuitem"]:first-of-type');
                    } catch (e) {
                        error = e as Error;
                        errorType = AutomationErrorType.x_runJob_deleteRetweets_WaitForMenuFailed;
                        this.log("runJobDeleteRetweets", ["wait for unretweet menu to appear failed, try #", tries]);
                        await this.sleep(1000);
                        continue;
                    }
                    await this.sleep(200);

                    // Click the delete button
                    await this.scriptClickElement('div[role="menu"] div[role="menuitem"]:first-of-type');
                    await this.sleep(200);

                    success = true;
                    break;
                } else {
                    this.log("Already unretweeted", tweetsToDelete.tweets[i].tweetID);
                    success = true;
                    break;
                }
            }

            if (success) {
                // Mark the tweet as deleted
                try {
                    // Deleting retweets uses the same deleteTweet IPC function as deleting tweets
                    await window.electron.X.deleteTweet(this.account?.id, tweetsToDelete.tweets[i].tweetID);
                } catch (e) {
                    await this.error(AutomationErrorType.x_runJob_deleteRetweets_FailedToUpdateDeleteTimestamp, {
                        exception: (e as Error).toString()
                    }, {
                        tweet: tweetsToDelete.tweets[i],
                        index: i
                    })
                    errorTriggered = true;
                    break;
                }

                this.progress.retweetsDeleted += 1;
                await this.syncProgress();
            } else {
                await this.error(errorType, {
                    exception: (error as Error).toString()
                });
                errorTriggered = true;
                break;
            }
        }

        if (errorTriggered) {
            return false;
        }

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobDeleteLikes(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_DELETE_LIKES, navigator.userAgent);

        // After this job, we want to reload the user stats
        await window.electron.X.setConfig(this.account?.id, 'reloadUserStats', 'true');

        let tweetsToDelete: XDeleteTweetsStartResponse;
        let alreadyDeleted = false;

        this.showBrowser = true;
        this.instructions = `**I'm deleting your likes, starting with the earliest.**`;
        this.showAutomationNotice = true;

        // Load the likes to delete
        try {
            tweetsToDelete = await window.electron.X.deleteLikesStart(this.account?.id);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_deleteLikes_FailedToStart, {
                exception: (e as Error).toString()
            })
            return false;
        }
        this.log('runJob', ["jobType=deleteLikes", "deleteLikesStartResponse", tweetsToDelete]);

        // Start the progress
        this.progress.totalLikesToDelete = tweetsToDelete.tweets.length;
        this.progress.likesDeleted = 0;
        await this.syncProgress();

        let errorTriggered = false;
        for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
            alreadyDeleted = false;

            // Load the URL
            await this.loadURLWithRateLimit(
                `https://x.com/${tweetsToDelete.tweets[i].username}/status/${tweetsToDelete.tweets[i].tweetID}`,
                // It's okay if the URL changes as long as the tweetID is the same
                // This happens if the user has changed their username
                [RegExp(`https://x\\.com/.*/status/${tweetsToDelete.tweets[i].tweetID}`)]
            );
            await this.sleep(200);

            await this.waitForPause();

            // Wait for the unlike button to appear
            try {
                await this.waitForSelector('article[tabindex="-1"] button[data-testid="unlike"]');
            } catch (e) {
                // If it doesn't appear, let's assume this like was already deleted
                alreadyDeleted = true;
            }
            await this.sleep(200);

            if (!alreadyDeleted) {
                // Click the unlike button
                await this.scriptClickElement('article[tabindex="-1"] button[data-testid="unlike"]');
                await this.sleep(200);
            } else {
                this.log("Already unliked", tweetsToDelete.tweets[i].tweetID);
            }

            // Mark the tweet as deleted
            try {
                // Deleting likes uses the same deleteTweet IPC function as deleting tweets
                await window.electron.X.deleteTweet(this.account?.id, tweetsToDelete.tweets[i].tweetID);
            } catch (e) {
                await this.error(AutomationErrorType.x_runJob_deleteLikes_FailedToUpdateDeleteTimestamp, {
                    exception: (e as Error).toString()
                }, {
                    tweet: tweetsToDelete.tweets[i],
                    index: i
                })
                errorTriggered = true;
                break;
            }

            this.progress.likesDeleted += 1;
            await this.syncProgress();
        }

        if (errorTriggered) {
            return false;
        }

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobDeleteDMs(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_DELETE_DMS, navigator.userAgent);

        let tries: number, success: boolean;
        let error: Error | null = null;
        let errorType: AutomationErrorType = AutomationErrorType.x_runJob_deleteDMs_UnknownError;

        let errorTriggered = false;
        let reloadDMsPage = true;

        this.showBrowser = true;
        this.instructions = `**I'm deleting all your direct message conversations, starting with the most recent.**`;
        this.showAutomationNotice = true;

        // Start the progress
        await this.syncProgress();
        this.progress.isDeleteDMsFinished = false;
        this.progress.conversationsDeleted = 0;

        // Loop through all of the conversations, deleting them one at a time until they are gone
        // eslint-disable-next-line no-constant-condition
        while (true) {
            error = null;
            success = false;

            await this.waitForPause();

            // Try 3 times, in case of rate limit or error
            for (tries = 0; tries < 3; tries++) {
                errorTriggered = false;

                // Load the DMs page, if necessary
                if (reloadDMsPage) {
                    if (await this.deleteDMsLoadDMsPage()) {
                        return false;
                    }
                    reloadDMsPage = false;
                }

                // When loading the DMs page in the previous step, if there are no conversations it sets isDeleteDMsFinished to true
                if (this.progress.isDeleteDMsFinished) {
                    this.log('runJobDeleteDMs', ["no more conversations, so ending deleteDMS"]);
                    await window.electron.X.deleteDMsMarkAllDeleted(this.account?.id);
                    success = true;
                    break;
                }

                // Wait for conversation selector
                try {
                    await this.waitForSelector('div[data-testid="conversation"]');
                } catch (e) {
                    errorTriggered = true;
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                        reloadDMsPage = true;
                        tries--;
                        continue;
                    } else {
                        error = e as Error;
                        errorType = AutomationErrorType.x_runJob_deleteDMs_WaitForConversationsFailed;
                        this.log("runJobDeleteDMs", ["wait for conversation selector failed, try #", tries]);
                        reloadDMsPage = true;
                        continue;
                    }
                }

                // Mouseover the first conversation
                if (!await this.scriptMouseoverElementFirst('div[data-testid="conversation"]')) {
                    errorTriggered = true;
                    errorType = AutomationErrorType.x_runJob_deleteDMs_MouseoverFailed;
                    reloadDMsPage = true;
                    continue;
                }

                // Wait for menu button selector
                try {
                    await this.waitForSelectorWithinSelector(
                        'div[data-testid="conversation"]',
                        'button',
                    )
                } catch (e) {
                    errorTriggered = true;
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                        reloadDMsPage = true;
                        tries--;
                        continue;
                    } else {
                        error = e as Error;
                        errorType = AutomationErrorType.x_runJob_deleteDMs_WaitForMenuButtonFailed;
                        this.log("runJobDeleteDMs", ["wait for menu button selector failed, try #", tries]);
                        reloadDMsPage = true;
                        continue;
                    }
                }

                // Click the menu button
                if (!await this.scriptClickElementWithinElementFirst('div[data-testid="conversation"]', 'button')) {
                    errorTriggered = true;
                    errorType = AutomationErrorType.x_runJob_deleteDMs_ClickMenuFailed;
                    reloadDMsPage = true;
                    continue;
                }

                // Wait for delete button selector
                try {
                    await this.waitForSelector(
                        'div[data-testid="Dropdown"] div[role="menuitem"]:last-of-type',
                    )
                } catch (e) {
                    errorTriggered = true;
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                        reloadDMsPage = true;
                        tries--;
                        continue;
                    } else {
                        error = e as Error;
                        errorType = AutomationErrorType.x_runJob_deleteDMs_WaitForDeleteButtonFailed;
                        this.log("runJobDeleteDMs", ["wait for delete button selector failed, try #", tries]);
                        reloadDMsPage = true;
                        continue;
                    }
                }

                // Click the delete button
                if (!await this.scriptClickElement('div[data-testid="Dropdown"] div[role="menuitem"]:last-of-type')) {
                    errorTriggered = true;
                    errorType = AutomationErrorType.x_runJob_deleteDMs_ClickDeleteFailed;
                    reloadDMsPage = true;
                    continue;
                }

                // Wait for delete confirm selector
                try {
                    await this.waitForSelector(
                        'button[data-testid="confirmationSheetConfirm"]',
                    )
                } catch (e) {
                    errorTriggered = true;
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                        reloadDMsPage = true;
                        tries--;
                        continue;
                    } else {
                        error = e as Error;
                        errorType = AutomationErrorType.x_runJob_deleteDMs_WaitForConfirmButtonFailed;
                        this.log("runJobDeleteDMs", ["wait for confirm button selector failed, try #", tries]);
                        reloadDMsPage = true;
                        continue;
                    }
                }

                // Click the confirm button
                if (!await this.scriptClickElement('button[data-testid="confirmationSheetConfirm"]')) {
                    errorTriggered = true;
                    errorType = AutomationErrorType.x_runJob_deleteDMs_ClickConfirmFailed;
                    reloadDMsPage = true;
                    continue;
                }

                if (!errorTriggered) {
                    // Update progress
                    this.progress.conversationsDeleted += 1;
                    await window.electron.X.setConfig(this.account?.id, 'totalConversationsDeleted', `${this.progress.conversationsDeleted}`);
                    break;
                }
            }

            await this.sleep(500);
            await this.waitForLoadingToFinish();

            if (success) {
                break;
            }

            if (errorTriggered) {
                if (error) {
                    await this.error(errorType, { exception: (error as Error).toString() });
                } else {
                    await this.error(errorType, {});
                }
                break;
            }
        }

        // Submit progress to the API
        this.emitter?.emit(`x-submit-progress-${this.account?.id}`);

        if (errorTriggered) {
            return false;
        }

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobDownloadArchive(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_DOWNLOAD_ARCHIVE, navigator.userAgent);

        this.showBrowser = true;
        this.showAutomationNotice = false;
        this.instructions = `
Follow the instructions below to request your archive from X. You will need to verify your identity with X to download your data.`;

        await this.loadURL("https://x.com/settings/download_your_data");
        await this.sleep(1000);

        // Wait for the user to request the archive
        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Check the URL
            const currentURL = this.webview?.getURL();
            if (currentURL == "https://x.com/settings/download_your_data") {
                if (await this.isSelectorLastDisabled('main div div button')) {
                    // The request archive button is disabled, which means we have requested the archive
                    await this.sleep(1000);
                    break;
                }
            }
            await this.sleep(1000);
        }

        await this.finishJob(jobIndex);
        return true;
    }

    async runJobUnfollowEveryone(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_UNFOLLOW_EVERYONE, navigator.userAgent);

        let tries: number, success: boolean;
        let error: Error | null = null;
        let errorType: AutomationErrorType = AutomationErrorType.x_runJob_unfollowEveryone_UnknownError;

        let errorTriggered = false;
        let reloadFollowingPage = true;
        let numberOfAccountsToUnfollow = 0;
        let accountToUnfollowIndex = 0;

        this.showBrowser = true;
        this.instructions = `**I'm unfollowing everyone on X for you.**`;
        this.showAutomationNotice = true;

        // Start the progress
        await this.syncProgress();
        this.progress.isUnfollowEveryoneFinished = false;
        this.progress.accountsUnfollowed = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            error = null;
            success = false;

            await this.waitForPause();

            // Try 3 times, in case of rate limit or error
            for (tries = 0; tries < 3; tries++) {
                errorTriggered = false;

                // Load the following page, if necessary
                if (reloadFollowingPage) {
                    if (await this.unfollowEveryoneLoadPage()) {
                        return false;
                    }
                    reloadFollowingPage = false;

                    // Count the number of accounts to unfollow in the DOM
                    numberOfAccountsToUnfollow = await this.countSelectorsFound('div[data-testid="cellInnerDiv"] button button');
                    accountToUnfollowIndex = 0;
                }

                // When loading the following page in the previous step, if there are following users it sets isUnfollowEveryoneFinished to true
                if (this.progress.isUnfollowEveryoneFinished) {
                    this.log('runJobUnfollowEveryone', ["no more following users, so ending unfollowEveryone"]);
                    success = true;
                    break;
                }

                // Mouseover the "Following" button on the next user
                if (!await this.scriptMouseoverElementNth('div[data-testid="cellInnerDiv"] button button', accountToUnfollowIndex)) {
                    errorTriggered = true;
                    errorType = AutomationErrorType.x_runJob_unfollowEveryone_MouseoverFailed;
                    reloadFollowingPage = true;
                    continue;
                }

                // Click the unfollow button
                if (!await this.scriptClickElementNth('div[data-testid="cellInnerDiv"] button button', accountToUnfollowIndex)) {
                    errorTriggered = true;
                    errorType = AutomationErrorType.x_runJob_unfollowEveryone_ClickUnfollowFailed;
                    reloadFollowingPage = true;
                    continue;
                }

                // Wait for confirm button
                try {
                    await this.waitForSelector(
                        'button[data-testid="confirmationSheetConfirm"]',
                    )
                } catch (e) {
                    errorTriggered = true;
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                        reloadFollowingPage = true;
                        tries--;
                        continue;
                    } else {
                        error = e as Error;
                        errorType = AutomationErrorType.x_runJob_unfollowEveryone_WaitForConfirmButtonFailed;
                        this.log("runJobUnfollowEveryone", ["wait for confirm button selector failed, try #", tries]);
                        reloadFollowingPage = true;
                        continue;
                    }
                }

                // Click the confirm button
                if (!await this.scriptClickElement('button[data-testid="confirmationSheetConfirm"]')) {
                    errorTriggered = true;
                    errorType = AutomationErrorType.x_runJob_unfollowEveryone_ClickConfirmFailed;
                    reloadFollowingPage = true;
                    continue;
                }

                if (!errorTriggered) {
                    // Update progress
                    this.progress.accountsUnfollowed += 1;
                    await window.electron.X.setConfig(this.account?.id, 'totalAccountsUnfollowed', `${this.progress.accountsUnfollowed}`);

                    // Increment the account index
                    accountToUnfollowIndex++;
                    if (accountToUnfollowIndex >= numberOfAccountsToUnfollow) {
                        reloadFollowingPage = true;
                    }
                    break;
                }
            }

            await this.sleep(500);

            if (success) {
                break;
            }

            if (errorTriggered) {
                if (error) {
                    await this.error(errorType, { exception: (error as Error).toString() });
                } else {
                    await this.error(errorType, {});
                }
                break;
            }
        }

        // Submit progress to the API
        this.emitter?.emit(`x-submit-progress-${this.account?.id}`);

        if (errorTriggered) {
            return false;
        }

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
        await window.electron.X.updateJob(this.account?.id, JSON.stringify(this.jobs[jobIndex]));

        // Set the current job immediately
        this.progress.currentJob = this.jobs[jobIndex].jobType;
        await this.syncProgress();

        this.log("runJob", `running job ${this.jobs[jobIndex].jobType}`);
        switch (this.jobs[jobIndex].jobType) {
            case "login":
                await this.runJobLogin(jobIndex);
                break;

            case "indexTweets":
                await this.runJobIndexTweets(jobIndex);
                break;

            case "archiveTweets":
                await this.runJobArchiveTweets(jobIndex);
                break;

            case "indexConversations":
                await this.runJobIndexConversations(jobIndex);
                break;

            case "indexMessages":
                await this.runJobIndexMessages(jobIndex);
                break;

            case "archiveBuild":
                await this.runJobArchiveBuild(jobIndex);
                break;

            case "indexLikes":
                await this.runJobIndexLikes(jobIndex);
                break;

            case "deleteTweets":
                await this.runJobDeleteTweets(jobIndex);
                break;

            case "deleteRetweets":
                await this.runJobDeleteRetweets(jobIndex);
                break;

            case "deleteLikes":
                await this.runJobDeleteLikes(jobIndex);
                break;

            case "unfollowEveryone":
                await this.runJobUnfollowEveryone(jobIndex);
                break;

            case "deleteDMs":
                await this.runJobDeleteDMs(jobIndex);
                break;

            case "downloadArchive":
                await this.runJobDownloadArchive(jobIndex);
                break;
        }
    }

    async run() {
        // Reset logs before running any state
        this.resetLogs();

        // Temp variables
        let databaseStatsString: string = "";
        let downloadArchiveInJobs = false;

        this.log("run", `running state: ${this.state}`);
        try {
            switch (this.state) {
                case State.Login:
                    this.actionString = `Hello, friend! My name is **Cyd**. I can help you save and delete your tweets, likes, and direct messages from X.`;
                    this.instructions = `${this.actionString}

**To get started, log in to your X account below.**`;
                    this.showBrowser = true;
                    this.showAutomationNotice = false;
                    await this.login();
                    this.state = State.WizardPrestart;
                    break;

                case State.WizardPrestart:
                    // Only load user stats if we don't know them yet, or if there's a config telling us to
                    if (
                        this.account.xAccount?.tweetsCount === -1 ||
                        this.account.xAccount?.likesCount === -1 ||
                        await window.electron.X.getConfig(this.account?.id, 'reloadUserStats') == "true"
                    ) {
                        await this.loadUserStats();
                    }
                    this.state = State.WizardStart;
                    break;

                case State.WizardStart:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    if (
                        await window.electron.X.getConfig(this.account?.id, 'lastFinishedJob_importArchive') ||
                        await window.electron.X.getConfig(this.account?.id, 'lastFinishedJob_indexTweets') ||
                        await window.electron.X.getConfig(this.account?.id, 'lastFinishedJob_indexLikes')
                    ) {
                        this.state = State.WizardDeleteOptions;
                    } else {
                        this.state = State.WizardImportOrBuild;
                    }
                    break;

                case State.WizardImportOrBuild:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    this.instructions = `
**I need a local database of the data in your X account before I can delete it.**

You can either import an X archive, or I can build it from scratch by scrolling through your profile.`;
                    this.state = State.WizardImportOrBuildDisplay;
                    break;

                case State.WizardImportStart:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    this.instructions = `
**Have you already downloaded your archive from X?**`;
                    this.state = State.WizardImportStartDisplay;
                    break;

                case State.WizardImportDownload:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    this.instructions = `You have requested your X archive, so now we wait.`;
                    this.state = State.WizardImportDownloadDisplay;
                    break;

                case State.WizardImporting:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    this.instructions = `
**I'll help you import your X archive into your local database.**`;
                    this.state = State.WizardImportingDisplay;
                    break;

                case State.WizardBuildOptions:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    this.instructions = `
I'll help you build a private local database of your X data to the \`Documents\` folder on your computer. 
You'll be able to access it even after you delete it from X.

**Which data do you want to save?**`;
                    this.state = State.WizardBuildOptionsDisplay;
                    break;

                case State.WizardDeleteOptions:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    this.instructions = `
**Which data do you want to delete?**`;
                    this.state = State.WizardDeleteOptionsDisplay;
                    break;

                case State.WizardReview:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    this.instructions = `I'm almost ready to start helping you claw back your data from X!

**Here's what I'm planning on doing.**`;
                    this.state = State.WizardReviewDisplay;
                    break;

                case State.WizardDeleteReview:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    databaseStatsString = await this.getDatabaseStatsString();
                    this.instructions = "I've finished saving the data I need before I can start deleting."
                    if (databaseStatsString != "") {
                        this.instructions += `\n\nI've saved: **${await this.getDatabaseStatsString()}**.`
                    }
                    this.state = State.WizardDeleteReviewDisplay;
                    break;

                case State.FinishedRunningJobs:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    this.instructions = `
All done!

**Here's what I did.**`;
                    this.state = State.FinishedRunningJobsDisplay;
                    break;

                case State.WizardCheckPremium:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    this.instructions = `**I'm almost ready to delete your data from X!**

You can save all your data for free, but you need a Premium plan to delete your data.`;
                    this.state = State.WizardCheckPremiumDisplay;
                    break;

                case State.RunJobs:
                    this.progress = await window.electron.X.resetProgress(this.account?.id);

                    // Empty the error queue
                    window.localStorage.setItem('automationErrors', JSON.stringify([]));

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
                            await this.error(AutomationErrorType.x_runJob_UnknownError, {
                                exception: (e as Error).toString()
                            });
                            break;
                        }
                    }
                    this.currentJobIndex = 0;

                    await this.refreshDatabaseStats();

                    // See if the jobs include downloadArchives
                    downloadArchiveInJobs = false;
                    for (let i = 0; i < this.jobs.length; i++) {
                        if (this.jobs[i].jobType === "downloadArchive") {
                            downloadArchiveInJobs = true;
                            break;
                        }
                    }

                    // Determine the next state
                    if (downloadArchiveInJobs) {
                        this.state = State.WizardImportDownload;
                    } else {
                        this.state = State.FinishedRunningJobs;
                    }

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
                exception: (e as Error).toString(),
                state: this.state,
                jobs: this.jobs,
                currentJobIndex: this.currentJobIndex,
            });
        }
    }

    saveState(): XViewModelState {
        return {
            "state": this.state as State,
            "action": this.action,
            "actionString": this.actionString,
            "progress": this.progress,
            "jobs": this.jobs,
            "currentJobIndex": this.currentJobIndex,
        }
    }

    restoreState(state: XViewModelState) {
        this.state = state.state;
        this.action = state.action;
        this.actionString = state.actionString;
        this.progress = state.progress;
        this.jobs = state.jobs;
        this.currentJobIndex = state.currentJobIndex;
    }
}