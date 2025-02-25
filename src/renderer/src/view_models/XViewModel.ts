import { WebviewTag } from 'electron';
import { BaseViewModel, TimeoutError, URLChangedError, InternetDownError } from './BaseViewModel';
import {
    ArchiveInfo, emptyArchiveInfo,
    XJob,
    XProgress, emptyXProgress,
    XTweetItem,
    XTweetItemArchive,
    XArchiveStartResponse,
    XIndexMessagesStartResponse,
    XRateLimitInfo, emptyXRateLimitInfo,
    XProgressInfo, emptyXProgressInfo,
    XDeleteTweetsStartResponse,
    XDatabaseStats, emptyXDatabaseStats,
    XDeleteReviewStats, emptyXDeleteReviewStats
} from '../../../shared_types';
import { XViewerResults, XUserInfo } from "../types_x"
import { PlausibleEvents } from "../types";
import { AutomationErrorType } from '../automation_errors';
import { xHasSomeData } from '../util_x';

// This is the Bearer token used by X's public web client, it's not a secret
const X_AUTHORIZATION_HEADER = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

export enum State {
    Login = "Login",

    WizardPrestart = "WizardPrestart",
    WizardStart = "WizardStart",

    WizardDatabase = "WizardDatabase",
    WizardDatabaseDisplay = "WizardDatabaseDisplay",

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

    WizardArchiveOptions = "WizardArchiveOptions",
    WizardArchiveOptionsDisplay = "WizardArchiveOptionsDisplay",

    WizardDeleteOptions = "WizardDeleteOptions",
    WizardDeleteOptionsDisplay = "WizardDeleteOptionsDisplay",

    WizardReview = "WizardReview",
    WizardReviewDisplay = "WizardReviewDisplay",

    WizardDeleteReview = "WizardDeleteReview",
    WizardDeleteReviewDisplay = "WizardDeleteReviewDisplay",

    WizardCheckPremium = "WizardCheckPremium",
    WizardCheckPremiumDisplay = "WizardCheckPremiumDisplay",

    WizardMigrateToBluesky = "WizardMigrateToBluesky",
    WizardMigrateToBlueskyDisplay = "WizardMigrateToBlueskyDisplay",

    RunJobs = "RunJobs",

    FinishedRunningJobs = "FinishedRunningJobs",
    FinishedRunningJobsDisplay = "FinishedRunningJobsDisplay",

    Debug = "Debug",
}

// When state is state is RunJobs, this is the job that is currently running, if
// it requires hiding the browser and instead showing stuff in AccountXView
export enum RunJobsState {
    Default = "",
    DeleteTweets = "DeleteTweets",
    DeleteRetweets = "DeleteRetweets",
    DeleteLikes = "DeleteLikes",
    DeleteBookmarks = "DeleteBookmarks",
}

export enum FailureState {
    indexTweets_FailedToRetryAfterRateLimit = "indexTweets_FailedToRetryAfterRateLimit",
    indexLikes_FailedToRetryAfterRateLimit = "indexLikes_FailedToRetryAfterRateLimit",
    indexBookmarks_FailedToRetryAfterRateLimit = "indexBookmarks_FailedToRetryAfterRateLimit",
}

export type XViewModelState = {
    state: State;
    action: string;
    actionString: string;
    progress: XProgress;
    jobs: XJob[];
    currentJobIndex: number;
}

export class XViewModel extends BaseViewModel {
    public progress: XProgress = emptyXProgress();
    public rateLimitInfo: XRateLimitInfo = emptyXRateLimitInfo();
    public progressInfo: XProgressInfo = emptyXProgressInfo();
    public databaseStats: XDatabaseStats = emptyXDatabaseStats();
    public deleteReviewStats: XDeleteReviewStats = emptyXDeleteReviewStats();
    public archiveInfo: ArchiveInfo = emptyArchiveInfo();
    public jobs: XJob[] = [];
    public currentJobIndex: number = 0;
    public currentTweetItem: XTweetItem | null = null;

    // This is used to track the user's progress through the wizard. If they want to review before
    // they delete, this lets them go back and change settings without starting over
    public isDeleteReviewActive: boolean = false;

    // Variables related to debugging
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
        this.archiveInfo = await window.electron.archive.getInfo(this.account?.id);
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
            if (this.account?.xAccount?.archiveBookmarks) {
                jobTypes.push("indexBookmarks");
            }
            if (this.account?.xAccount?.archiveDMs) {
                jobTypes.push("indexConversations");
                jobTypes.push("indexMessages");
            }
        }

        if (this.account?.xAccount?.archiveMyData) {
            shouldBuildArchive = true;
            if (this.account?.xAccount?.archiveTweetsHTML) {
                jobTypes.push("archiveTweets");
            }
            if (this.account?.xAccount?.archiveBookmarks) {
                jobTypes.push("indexBookmarks");
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
            if (hasSomeData && this.account?.xAccount?.deleteBookmarks) {
                jobTypes.push("deleteBookmarks");
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

    async reset() {
        this.progress = emptyXProgress();
        this.rateLimitInfo = emptyXRateLimitInfo();
        this.jobs = [];
        this.state = State.WizardPrestart;
    }

    // Returns the API response's status code, or 0 on error
    async graphqlDelete(ct0: string, url: string, referrer: string, body: string): Promise<number> {
        this.log("graphqlDelete", [url, body]);
        return await this.getWebview()?.executeJavaScript(`
            (async () => {
                const transactionID = [...crypto.getRandomValues(new Uint8Array(95))].map((x, i) => (i = x / 255 * 61 | 0, String.fromCharCode(i + (i > 9 ? i > 35 ? 61 : 55 : 48)))).join('');
                try {
                    const response = await fetch('${url}', {
                        "headers": {
                            "authorization": "${X_AUTHORIZATION_HEADER}",
                            "content-type": "application/json",
                            "x-client-transaction-id": transactionID,
                            "x-csrf-token": '${ct0}',
                            "x-twitter-active-user": "yes",
                            "x-twitter-auth-type": "OAuth2Session"
                        },
                        "referrer": '${referrer}',
                        "referrerPolicy": "strict-origin-when-cross-origin",
                        "body": '${body}',
                        "method": "POST",
                        "mode": "cors",
                        "credentials": "include",
                        "signal": AbortSignal.timeout(5000)
                    })
                    console.log(response.status);
                    if (response.status == 200) {
                        console.log(await response.text());
                    }
                    return response.status;
                } catch (e) {
                    return 0;
                }
            })();
        `);
    }

    // Returns an XUserInfo object, or null on error
    async graphqlGetViewerUser(): Promise<XUserInfo | null> {
        this.log("graphqlGetViewerUser");
        const url = 'https://api.x.com/graphql/WBT8ommFCSHiy3z2_4k1Vg/Viewer?variables=%7B%22withCommunitiesMemberships%22%3Atrue%7D&features=%7B%22profile_label_improvements_pcf_label_in_post_enabled%22%3Atrue%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%7D&fieldToggles=%7B%22isDelegate%22%3Afalse%2C%22withAuxiliaryUserLabels%22%3Afalse%7D';
        const ct0 = await window.electron.X.getCookie(this.account?.id, 'api.x.com', 'ct0');

        if (ct0 === null) {
            this.log("graphqlGetViewerUser", "ct0 is null");
            return null;
        }

        const resp: string | null = await this.getWebview()?.executeJavaScript(`
            (async () => {
                const transactionID = [...crypto.getRandomValues(new Uint8Array(95))].map((x, i) => (i = x / 255 * 61 | 0, String.fromCharCode(i + (i > 9 ? i > 35 ? 61 : 55 : 48)))).join('');
                try {
                    const response = await fetch('${url}', {
                        "headers": {
                            "authorization": "${X_AUTHORIZATION_HEADER}",
                            "content-type": "application/json",
                            "x-client-transaction-id": transactionID,
                            "x-csrf-token": '${ct0}',
                            "x-twitter-client-language": "en",
                            "x-twitter-active-user": "yes",
                            "origin": 'https://x.com',
                            "sec-fetch-site": "same-site",
                            "sec-fetch-mode": "cors",
                            "sec-fetch-dest": "empty"
                        },
                        "referrer": 'https://x.com/',
                        "method": "GET",
                        "mode": "cors",
                        "credentials": "include",
                        "signal": AbortSignal.timeout(5000)
                    })
                    if (response.status == 200) {
                        return await response.text();
                    }
                    return null;
                } catch (e) {
                    return null;
                }
            })();
        `);

        if (resp === null) {
            this.log("graphqlGetViewerUser", "response is null");
            return null;
        } else {
            try {
                const viewerResults: XViewerResults = JSON.parse(resp);
                const userInfo: XUserInfo = {
                    username: viewerResults.data.viewer.user_results.result.legacy.screen_name,
                    userID: viewerResults.data.viewer.user_results.result.rest_id,
                    profileImageDataURI: await window.electron.X.getImageDataURI(this.account.id, viewerResults.data.viewer.user_results.result.legacy.profile_image_url_https),
                    followingCount: viewerResults.data.viewer.user_results.result.legacy.friends_count,
                    followersCount: viewerResults.data.viewer.user_results.result.legacy.followers_count,
                    tweetsCount: viewerResults.data.viewer.user_results.result.legacy.statuses_count,
                    likesCount: viewerResults.data.viewer.user_results.result.legacy.favourites_count,
                };
                return userInfo;
            } catch (e) {
                this.log("graphqlGetViewerUser", `error parsing response: ${resp}`);
                return null;
            }
        }
    }

    async waitForRateLimit() {
        this.log("waitForRateLimit", this.rateLimitInfo);

        let seconds = 0;
        if (this.rateLimitInfo.rateLimitReset) {
            seconds = this.rateLimitInfo.rateLimitReset - Math.floor(Date.now() / 1000);
        }
        await this.sleep(seconds * 1000);
        this.log("waitForRateLimit", "finished waiting for rate limit");

        // Reset the rate limit checker
        await window.electron.X.resetRateLimitInfo(this.account?.id);
        this.rateLimitInfo = emptyXRateLimitInfo();

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
        await this.sleep(1000);

        // If this is the first time we're logging in, track it
        if (this.state === State.Login) {
            await window.electron.trackEvent(PlausibleEvents.X_USER_SIGNED_IN, navigator.userAgent);
        }

        await this.waitForPause();

        // Load home
        this.log("login", "getting username and userID and profile picture");
        this.instructions = `I'm discovering your username and profile picture...`;

        if (this.webview?.getURL() != "https://x.com/home") {
            await this.loadURLWithRateLimit("https://x.com/home");
        }

        // See if cookie overlay is present, and if so click "Refuse non-essential cookies"
        if (await this.doesSelectorExist('div[data-testid="BottomBar"]')) {
            await this.scriptClickElementWithinElementLast('div[data-testid="BottomBar"]', 'button');
            await this.sleep(500);
            await this.scriptClickElementWithinElementLast('div[data-testid="BottomBar"]', 'button');
        }

        const userInfo: XUserInfo | null = await this.graphqlGetViewerUser();
        if (userInfo === null) {
            await this.error(AutomationErrorType.X_login_GetViewerUserFailed, {
                exception: "userInfo is null"
            });
            return;
        }

        // Save the user information
        if (this.account && this.account?.xAccount) {
            this.account.xAccount.username = userInfo.username;
            this.account.xAccount.userID = userInfo.userID;
            this.account.xAccount.profileImageDataURI = userInfo.profileImageDataURI;
            this.account.xAccount.followersCount = userInfo.followersCount;
            this.account.xAccount.followingCount = userInfo.followingCount;
            this.account.xAccount.tweetsCount = userInfo.tweetsCount;
            this.account.xAccount.likesCount = userInfo.likesCount;
        }
        await window.electron.database.saveAccount(JSON.stringify(this.account));
        this.log("login", "saved user information");

        await this.waitForPause();
    }

    async loadUserStats() {
        this.log("loadUserStats", "loading user stats");
        this.showBrowser = true;
        this.showAutomationNotice = true;

        this.log("login", "getting user stats");
        this.instructions = `I'm trying to determine your total tweets and likes, according to X...`;

        await this.login()
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

    async archiveSaveTweet(outputPath: string, tweetItem: XTweetItemArchive): Promise<boolean> {
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
            }, true);
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
            }, true)
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
                    this.progress.isIndexTweetsFinished = true;
                    await this.syncProgress();

                    // On success, set the failure state to false
                    await window.electron.X.setConfig(this.account?.id, FailureState.indexTweets_FailedToRetryAfterRateLimit, "false");
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
        this.instructions = `**I'm downloading HTML copies of your tweets, starting with the oldest.**

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
        for (let i = 0; i < archiveStartResponse.items.length; i++) {
            await this.waitForPause();

            // Save the tweet
            if (!await this.archiveSaveTweet(archiveStartResponse.outputPath, archiveStartResponse.items[i])) {
                this.log("runJobArchiveTweets", ["failed to save tweet", archiveStartResponse.items[i].tweetID]);
            }
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
                this.progress.isIndexConversationsFinished = true;
                await this.syncProgress();
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

    async runJobIndexMessages(jobIndex: number) {
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
                }, true);
            }

            if (shouldSkip) {
                continue;
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
                    }, true);
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

        await this.finishJob(jobIndex);
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
        await this.sleep(500);

        // Check if likes list is empty
        if (await this.doesSelectorExist('div[data-testid="emptyState"]')) {
            this.log("runJobIndexLikes", "no likes found");
            this.progress.isIndexLikesFinished = true;
            this.progress.likesIndexed = 0;
            await this.syncProgress();
        } else {
            this.log("runJobIndexLikes", "did not find empty state");
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
                this.progress = await window.electron.X.indexParseTweets(this.account?.id);
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
                    this.progress.isIndexLikesFinished = true;
                    await this.syncProgress();

                    // On success, set the failure state to false
                    await window.electron.X.setConfig(this.account?.id, FailureState.indexLikes_FailedToRetryAfterRateLimit, "false");
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

    async runJobIndexBookmarks(jobIndex: number): Promise<boolean> {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_INDEX_BOOKMARKS, navigator.userAgent);

        this.showBrowser = true;
        this.instructions = `**I'm saving your bookmarks.**

Hang on while I scroll down to your earliest bookmarks.`;
        this.showAutomationNotice = true;

        // Start monitoring network requests
        await this.loadBlank();
        await window.electron.X.indexStart(this.account?.id);
        await this.sleep(2000);

        // Start the progress
        this.progress.isIndexBookmarksFinished = false;
        this.progress.bookmarksIndexed = 0;
        await this.syncProgress();

        // Load the bookmarks
        let errorTriggered = false;
        await this.waitForPause();
        await window.electron.X.resetRateLimitInfo(this.account?.id);
        await this.loadURLWithRateLimit("https://x.com/i/bookmarks");
        await this.sleep(500);

        // Check if bookmarks list is empty
        if (await this.doesSelectorExist('div[data-testid="emptyState"]')) {
            this.log("runJobIndexBookmarks", "no bookmarks found");
            this.progress.isIndexBookmarksFinished = true;
            this.progress.bookmarksIndexed = 0;
            await this.syncProgress();
        } else {
            this.log("runJobIndexBookmarks", "did not find empty state");
        }

        if (!this.progress.isIndexBookmarksFinished) {
            // Wait for bookmarks to appear
            try {
                await this.waitForSelector('article', "https://x.com/i/bookmarks");
            } catch (e) {
                this.log("runJobIndexBookmarks", ["selector never appeared", e]);
                if (e instanceof TimeoutError) {
                    // Were we rate limited?
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                    } else {
                        // If the page isn't loading, we assume the user has no bookmarks yet
                        await this.waitForLoadingToFinish();
                        this.progress.isIndexBookmarksFinished = true;
                        this.progress.bookmarksIndexed = 0;
                        await this.syncProgress();
                    }
                } else if (e instanceof URLChangedError) {
                    const newURL = this.webview?.getURL();
                    await this.error(AutomationErrorType.x_runJob_indexBookmarks_URLChanged, {
                        newURL: newURL,
                        exception: (e as Error).toString()
                    })
                    errorTriggered = true;
                } else {
                    await this.error(AutomationErrorType.x_runJob_indexBookmarks_OtherError, {
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

        while (this.progress.isIndexBookmarksFinished === false) {
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
                    await window.electron.X.setConfig(this.account?.id, FailureState.indexBookmarks_FailedToRetryAfterRateLimit, "true");
                    break;
                }
                await this.sleep(500);
                moreToScroll = true;
            }

            // Parse so far
            try {
                this.progress = await window.electron.X.indexParseTweets(this.account?.id);
            } catch (e) {
                const latestResponseData = await window.electron.X.getLatestResponseData(this.account?.id);
                await this.error(AutomationErrorType.x_runJob_indexBookmarks_ParseTweetsError, {
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
                    await this.error(AutomationErrorType.x_runJob_indexBookmarks_VerifyThereIsNoMoreError, {
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
                    this.progress.isIndexBookmarksFinished = true;
                    await this.syncProgress();

                    // On success, set the failure state to false
                    await window.electron.X.setConfig(this.account?.id, FailureState.indexBookmarks_FailedToRetryAfterRateLimit, "false");
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

        this.runJobsState = RunJobsState.DeleteTweets;
        let tweetsToDelete: XDeleteTweetsStartResponse;
        this.instructions = `**I'm deleting your tweets based on your criteria, starting with the earliest.**`;

        // Load the tweets to delete
        try {
            tweetsToDelete = await window.electron.X.deleteTweetsStart(this.account?.id);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_deleteTweets_FailedToStart, {
                exception: (e as Error).toString()
            })
            return false;
        }
        this.log('runJobDeleteTweets', `found ${tweetsToDelete.tweets.length} tweets to delete`);

        // Start the progress
        this.progress.totalTweetsToDelete = tweetsToDelete.tweets.length;
        this.progress.tweetsDeleted = 0;
        this.progress.tweetsArchived = 0;
        this.progress.newTweetsArchived = 0;
        await this.syncProgress();

        // Load the replies page
        this.showBrowser = true;
        this.showAutomationNotice = true;
        await this.loadURLWithRateLimit("https://x.com/" + this.account?.xAccount?.username + "/with_replies");

        // Hide the browser and start showing other progress instead
        this.showBrowser = false;

        // Get the ct0 cookie
        const ct0: string | null = await window.electron.X.getCookie(this.account?.id, "x.com", "ct0");
        this.log('runJobDeleteTweets', ["ct0", ct0]);
        if (!ct0) {
            await this.error(AutomationErrorType.x_runJob_deleteTweets_Ct0CookieNotFound, {})
            return false;
        }

        for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
            this.currentTweetItem = tweetsToDelete.tweets[i];

            // Delete the tweet
            let tweetDeleted = false;
            let statusCode = 0;
            for (let tries = 0; tries < 3; tries++) {
                statusCode = await this.graphqlDelete(
                    ct0,
                    'https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet',
                    "https://x.com/" + this.account?.xAccount?.username + "/with_replies",
                    JSON.stringify({
                        "variables": {
                            "tweet_id": tweetsToDelete.tweets[i].id,
                            "dark_request": false
                        },
                        "queryId": "VaenaVgh5q5ih7kvyVjgtg"
                    }),
                );
                if (statusCode == 200) {
                    // Update the tweet's deletedAt date
                    try {
                        await window.electron.X.deleteTweet(this.account?.id, tweetsToDelete.tweets[i].id, "tweet");
                        tweetDeleted = true;
                        this.progress.tweetsDeleted += 1;
                        await this.syncProgress();
                    } catch (e) {
                        await this.error(AutomationErrorType.x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp, {
                            exception: (e as Error).toString()
                        }, {
                            tweet: tweetsToDelete.tweets[i],
                            index: i
                        }, true)
                    }
                    break;
                } else if (statusCode == 429) {
                    // Rate limited
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    await this.waitForRateLimit();
                    tries = 0;
                } else {
                    // Sleep 1 second and try again
                    this.log("runJobDeleteTweets", ["statusCode", statusCode, "failed to delete tweet, try #", tries]);
                    await this.sleep(1000);
                }
            }

            if (!tweetDeleted) {
                await this.error(AutomationErrorType.x_runJob_deleteTweets_FailedToDelete, {
                    statusCode: statusCode
                }, {
                    tweet: tweetsToDelete.tweets[i],
                    index: i
                }, true)

                this.progress.errorsOccured += 1;
                await this.syncProgress();
            }

            await this.waitForPause();
        }

        await this.finishJob(jobIndex);
    }

    async runJobDeleteRetweets(jobIndex: number) {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_DELETE_RETWEETS, navigator.userAgent);

        // After this job, we want to reload the user stats
        await window.electron.X.setConfig(this.account?.id, 'reloadUserStats', 'true');

        this.runJobsState = RunJobsState.DeleteRetweets;
        let tweetsToDelete: XDeleteTweetsStartResponse;
        this.instructions = `**I'm deleting your retweets, starting with the earliest.**`;

        // Load the retweets to delete
        try {
            tweetsToDelete = await window.electron.X.deleteRetweetsStart(this.account?.id);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_deleteRetweets_FailedToStart, {
                exception: (e as Error).toString()
            })
            return false;
        }
        this.log('runJob', ["jobType=deleteRetweets", "XDeleteTweetsStartResponse", tweetsToDelete]);

        // Start the progress
        this.progress.totalRetweetsToDelete = tweetsToDelete.tweets.length;
        this.progress.retweetsDeleted = 0;
        await this.syncProgress();

        // Load the tweets page
        this.showBrowser = true;
        this.showAutomationNotice = true;
        await this.loadURLWithRateLimit("https://x.com/" + this.account?.xAccount?.username);

        // Hide the browser and start showing other progress instead
        this.showBrowser = false;

        // Get the ct0 cookie
        const ct0: string | null = await window.electron.X.getCookie(this.account?.id, "x.com", "ct0");
        this.log('runJobDeleteRetweets', ["ct0", ct0]);
        if (!ct0) {
            await this.error(AutomationErrorType.x_runJob_deleteTweets_Ct0CookieNotFound, {})
            return false;
        }

        for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
            this.currentTweetItem = tweetsToDelete.tweets[i];

            // Delete the retweet
            let retweetDeleted = false;
            let statusCode = 0;
            for (let tries = 0; tries < 3; tries++) {
                // Delete the retweet (which also uses the delete tweet API route)
                statusCode = await this.graphqlDelete(
                    ct0,
                    'https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet',
                    "https://x.com/" + this.account?.xAccount?.username + "/with_replies",
                    JSON.stringify({
                        "variables": {
                            "tweet_id": tweetsToDelete.tweets[i].id,
                            "dark_request": false
                        },
                        "queryId": "VaenaVgh5q5ih7kvyVjgtg"
                    }),
                );
                if (statusCode == 200) {
                    this.log('runJobDeleteRetweets', ["deleted retweet", tweetsToDelete.tweets[i].id]);
                    // Update the tweet's deletedAt date
                    try {
                        await window.electron.X.deleteTweet(this.account?.id, tweetsToDelete.tweets[i].id, "retweet");
                        retweetDeleted = true;
                        this.progress.retweetsDeleted += 1;
                        await this.syncProgress();
                    } catch (e) {
                        await this.error(AutomationErrorType.x_runJob_deleteRetweets_FailedToUpdateDeleteTimestamp, {
                            exception: (e as Error).toString()
                        }, {
                            tweet: tweetsToDelete.tweets[i],
                            index: i
                        }, true)
                    }
                    break;
                } else if (statusCode == 429) {
                    // Rate limited
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    await this.waitForRateLimit();
                    tries = 0;
                } else {
                    // Sleep 1 second and try again
                    this.log("runJobDeleteRetweets", ["statusCode", statusCode, "failed to delete retweet, try #", tries]);
                    await this.sleep(1000);
                }
            }

            if (!retweetDeleted) {
                await this.error(AutomationErrorType.x_runJob_deleteRetweets_FailedToDelete, {
                    statusCode: statusCode
                }, {
                    tweet: tweetsToDelete.tweets[i],
                    index: i
                }, true)

                this.progress.errorsOccured += 1;
                await this.syncProgress();
            }

            await this.waitForPause();
        }

        await this.finishJob(jobIndex);
    }

    async runJobDeleteLikes(jobIndex: number) {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_DELETE_LIKES, navigator.userAgent);

        // After this job, we want to reload the user stats
        await window.electron.X.setConfig(this.account?.id, 'reloadUserStats', 'true');

        this.runJobsState = RunJobsState.DeleteLikes;
        let tweetsToDelete: XDeleteTweetsStartResponse;
        this.instructions = `**I'm deleting your likes, starting with the earliest.**`;

        // Load the likes to delete
        try {
            tweetsToDelete = await window.electron.X.deleteLikesStart(this.account?.id);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_deleteLikes_FailedToStart, {
                exception: (e as Error).toString()
            })
            return false;
        }
        this.log('runJobDeleteLikes', `found ${tweetsToDelete.tweets.length} likes to delete`);

        // Start the progress
        this.progress.totalLikesToDelete = tweetsToDelete.tweets.length;
        this.progress.likesDeleted = 0;
        await this.syncProgress();

        // Load the likes page
        this.showBrowser = true;
        this.showAutomationNotice = true;
        await this.loadURLWithRateLimit("https://x.com/" + this.account?.xAccount?.username + "/likes");

        // Hide the browser and start showing other progress instead
        this.showBrowser = false;

        // Get the ct0 cookie
        const ct0: string | null = await window.electron.X.getCookie(this.account?.id, "x.com", "ct0");
        this.log('runJobDeleteLikes', ["ct0", ct0]);
        if (!ct0) {
            await this.error(AutomationErrorType.x_runJob_deleteLikes_Ct0CookieNotFound, {})
            return false;
        }

        for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
            this.currentTweetItem = tweetsToDelete.tweets[i];

            // Delete the like
            let likeDeleted = false;
            let statusCode = 0;
            for (let tries = 0; tries < 3; tries++) {
                statusCode = await this.graphqlDelete(
                    ct0,
                    'https://x.com/i/api/graphql/ZYKSe-w7KEslx3JhSIk5LA/UnfavoriteTweet',
                    "https://x.com/" + this.account?.xAccount?.username + "/likes",
                    JSON.stringify({
                        "variables": {
                            "tweet_id": tweetsToDelete.tweets[i].id,
                        },
                        "queryId": "ZYKSe-w7KEslx3JhSIk5LA"
                    })
                );
                if (statusCode == 200) {
                    // Update the tweet's deletedAt date
                    try {
                        await window.electron.X.deleteTweet(this.account?.id, tweetsToDelete.tweets[i].id, "like");
                        likeDeleted = true;
                        this.progress.likesDeleted += 1;
                        await this.syncProgress();
                    } catch (e) {
                        await this.error(AutomationErrorType.x_runJob_deleteLikes_FailedToUpdateDeleteTimestamp, {
                            exception: (e as Error).toString()
                        }, {
                            tweet: tweetsToDelete.tweets[i],
                            index: i
                        }, true)
                    }
                    break;
                } else if (statusCode == 429) {
                    // Rate limited
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    await this.waitForRateLimit();
                    tries = 0;
                } else {
                    // Sleep 1 second and try again
                    this.log("runJobDeleteLikes", ["statusCode", statusCode, "failed to delete like, try #", tries]);
                    await this.sleep(1000);
                }
            }

            if (!likeDeleted) {
                await this.error(AutomationErrorType.x_runJob_deleteLikes_FailedToDelete, {
                    statusCode: statusCode
                }, {
                    tweet: tweetsToDelete.tweets[i],
                    index: i
                }, true)

                this.progress.errorsOccured += 1;
                await this.syncProgress();
            }

            await this.waitForPause();
        }

        await this.finishJob(jobIndex);
    }

    async runJobDeleteBookmarks(jobIndex: number) {
        await window.electron.trackEvent(PlausibleEvents.X_JOB_STARTED_DELETE_BOOKMARKS, navigator.userAgent);

        // After this job, we want to reload the user stats
        await window.electron.X.setConfig(this.account?.id, 'reloadUserStats', 'true');

        this.runJobsState = RunJobsState.DeleteBookmarks;
        let tweetsToDelete: XDeleteTweetsStartResponse;
        this.instructions = `**I'm deleting your bookmarks, starting with the earliest.**`;

        // Load the bookmarks to delete
        try {
            tweetsToDelete = await window.electron.X.deleteBookmarksStart(this.account?.id);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_deleteLikes_FailedToStart, {
                exception: (e as Error).toString()
            })
            return false;
        }
        this.log('runJobDeleteBookmarks', `found ${tweetsToDelete.tweets.length} bookmarks to delete`);

        // Start the progress
        this.progress.totalBookmarksToDelete = tweetsToDelete.tweets.length;
        this.progress.bookmarksDeleted = 0;
        await this.syncProgress();

        // Load the bookmarks page
        this.showBrowser = true;
        this.showAutomationNotice = true;
        await this.loadURLWithRateLimit("https://x.com/i/bookmarks");

        // Hide the browser and start showing other progress instead
        this.showBrowser = false;

        // Get the ct0 cookie
        const ct0: string | null = await window.electron.X.getCookie(this.account?.id, "x.com", "ct0");
        this.log('runJobDeleteBookmarks', ["ct0", ct0]);
        if (!ct0) {
            await this.error(AutomationErrorType.x_runJob_deleteBookmarks_Ct0CookieNotFound, {})
            return false;
        }

        for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
            this.currentTweetItem = tweetsToDelete.tweets[i];

            // Delete the bookmark
            let bookmarkDeleted = false;
            let statusCode = 0;
            for (let tries = 0; tries < 3; tries++) {
                statusCode = await this.graphqlDelete(
                    ct0,
                    'https://x.com/i/api/graphql/Wlmlj2-xzyS1GN3a6cj-mQ/DeleteBookmark',
                    "https://x.com/i/bookmarks",
                    JSON.stringify({
                        "variables": {
                            "tweet_id": tweetsToDelete.tweets[i].id
                        },
                        "queryId": "Wlmlj2-xzyS1GN3a6cj-mQ"
                    })
                );
                if (statusCode == 200) {
                    // Update the tweet's deletedAt date
                    try {
                        await window.electron.X.deleteTweet(this.account?.id, tweetsToDelete.tweets[i].id, "bookmark");
                        bookmarkDeleted = true;
                        this.progress.bookmarksDeleted += 1;
                        await this.syncProgress();
                    } catch (e) {
                        await this.error(AutomationErrorType.x_runJob_deleteBookmarks_FailedToUpdateDeleteTimestamp, {
                            exception: (e as Error).toString()
                        }, {
                            tweet: tweetsToDelete.tweets[i],
                            index: i
                        }, true)
                    }
                    break;
                } else if (statusCode == 429) {
                    // Rate limited
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account?.id);
                    await this.waitForRateLimit();
                    tries = 0;
                } else {
                    // Sleep 1 second and try again
                    this.log("runJobDeleteLikes", ["statusCode", statusCode, "failed to delete like, try #", tries]);
                    await this.sleep(1000);
                }
            }

            if (!bookmarkDeleted) {
                await this.error(AutomationErrorType.x_runJob_deleteBookmarks_FailedToDelete, {
                    statusCode: statusCode
                }, {
                    tweet: tweetsToDelete.tweets[i],
                    index: i
                }, true)

                this.progress.errorsOccured += 1;
                await this.syncProgress();
            }

            await this.waitForPause();
        }

        await this.finishJob(jobIndex);
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
        this.runJobsState = RunJobsState.Default;

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

            case "indexBookmarks":
                await this.runJobIndexBookmarks(jobIndex);
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

            case "deleteBookmarks":
                await this.runJobDeleteBookmarks(jobIndex);
                break;

            case "unfollowEveryone":
                await this.runJobUnfollowEveryone(jobIndex);
                break;

            case "deleteDMs":
                await this.runJobDeleteDMs(jobIndex);
                break;
        }
    }

    async run() {
        // Reset logs before running any state
        this.resetLogs();

        // Temp variables
        let databaseStatsString: string = "";

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
                    this.showBrowser = false;
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
                        this.state = State.WizardDatabase;
                    }
                    break;

                case State.WizardDatabase:
                    this.showBrowser = false;
                    this.instructions = `
**I need a local database of the data in your X account before I can delete it.**

You can either import an X archive, or I can build it from scratch by scrolling through your profile.`;
                    this.state = State.WizardDatabaseDisplay;
                    await this.loadURL("about:blank");
                    break;

                case State.WizardImportStart:
                    this.showBrowser = false;
                    this.instructions = `
**Before you can import your X archive, you need to download it from X. Here's how.**`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardImportStartDisplay;
                    break;

                case State.WizardImportDownload:
                    this.showBrowser = false;
                    this.instructions = `You have requested your X archive, so now we wait.`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardImportDownloadDisplay;
                    break;

                case State.WizardImporting:
                    this.showBrowser = false;
                    this.instructions = `
**I'll help you import your X archive into your local database.**`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardImportingDisplay;
                    break;

                case State.WizardBuildOptions:
                    this.showBrowser = false;
                    this.instructions = `
I'll help you build a private local database of your X data to the \`Documents\` folder on your computer.
You'll be able to access it even after you delete it from X.

**Which data do you want to save?**`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardBuildOptionsDisplay;
                    break;

                case State.WizardArchiveOptions:
                    this.showBrowser = false;
                    this.instructions = `
- I can save an HTML version of each of your tweets.
- I can backup a copy of your bookmarks, which isn't included in the official X archive.
- And I can also save a more detailed backup of your direct messages than is available in the official X archive.

**Which data do you want to save?**`;
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

                case State.WizardReview:
                    this.showBrowser = false;
                    this.instructions = `I'm almost ready to start helping you claw back your data from X!

**Here's what I'm planning on doing.**`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardReviewDisplay;
                    break;

                case State.WizardDeleteReview:
                    this.showBrowser = false;
                    databaseStatsString = await this.getDatabaseStatsString();
                    this.instructions = "I've finished saving the data I need before I can start deleting."
                    if (databaseStatsString != "") {
                        this.instructions += `\n\nI've saved: **${await this.getDatabaseStatsString()}**.`
                    }
                    await this.loadURL("about:blank");
                    this.state = State.WizardDeleteReviewDisplay;
                    break;

                case State.WizardMigrateToBluesky:
                    this.showBrowser = false;
                    await this.loadURL("about:blank");
                    this.instructions = `
**Just because you're quitting X doesn't mean your posts need to disappear.**

After you build a local database of your tweets, I can help you migrate them into a Bluesky account.`;
                    this.state = State.WizardMigrateToBlueskyDisplay;
                    break;

                case State.FinishedRunningJobs:
                    this.showBrowser = false;
                    this.instructions = `
All done!

**Here's what I did.**`;
                    await this.loadURL("about:blank");
                    this.state = State.FinishedRunningJobsDisplay;
                    break;

                case State.WizardCheckPremium:
                    this.showBrowser = false;
                    this.instructions = `**I'm almost ready to delete your data from X!**

You can save all your data for free, but you need a Premium plan to delete your data.`;
                    await this.loadURL("about:blank");
                    this.state = State.WizardCheckPremiumDisplay;
                    break;

                case State.RunJobs:
                    this.progress = await window.electron.X.resetProgress(this.account?.id);

                    // Dismiss old error reports
                    await window.electron.database.dismissNewErrorReports(this.account?.id);

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
