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

    // Returns the API response's status code, or 0 on error
    async graphqlDelete(url: string, referrer: string, body: URLSearchParams): Promise<number> {
        this.log("graphqlDelete", [url, body]);
        this.log(
            `const response = await fetch('${url}', {
                "headers": {
                    "content-type": "application/x-www-form-urlencoded",
                    "X-FB-Friendly-Name": "ProfileCometBulkStoryCurationMutation",
                    "X-ASBD-ID": "359341",
                    "X-FB-LSD": "wTDZUBVH-SkO66P4M4rD_S",
                },
                "referrer": '${referrer}',
                "body": '${body}',
                "method": "POST",
            })
            console.log(response.status);
            if (response.status == 200) {
                console.log(await response.text());
            }`
        )
        // return await this.getWebview()?.executeJavaScript(`
        //     (async () => {
        //         const transactionID = [...crypto.getRandomValues(new Uint8Array(95))].map((x, i) => (i = x / 255 * 61 | 0, String.fromCharCode(i + (i > 9 ? i > 35 ? 61 : 55 : 48)))).join('');
        //         try {
        //             const response = await fetch('${url}', {
        //                 "headers": {
        //                     "content-type": "application/x-www-form-urlencoded",
        //                     "X-FB-Friendly-Name": "ProfileCometBulkStoryCurationMutation",
        //                 },
        //                 "referrer": '${referrer}',
        //                 "body": '${body}',
        //                 "method": "POST",
        //             })
        //             console.log(response.status);
        //             if (response.status == 200) {
        //                 console.log(await response.text());
        //             }
        //             return response.status;
        //         } catch (e) {
        //             return 0;
        //         }
        //     })();
        // `);
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
            const formData = new URLSearchParams({
                "av": currentPostItem.a,
                "__aaid": "0",
                "__user": currentPostItem.a,
                "__a": "1",
                "__req": "1w",
                "__hs": "20286.HYP:comet_pkg.2.1...0",
                "dpr": "1",
                "__ccg": "EXCELLENT",
                "__rev": "1024844477",
                "__s": "pvamf1:3779rt:v7aahb",
                "__hsi": "7527981783556921304",
                "__dyn": "7xeUjGU5a5Q1ryaxG4Vp41twWwIxu13wFwhUKbgS3q2ibwNwnof8boG0x8bo6u3y4o2Gwfi0LVEtwMw6ywIK1Rwwwg8a8462mcwfG12wOx62G5Usw9m1YwBgK7o6C0Mo4G17yovwRwlE-U2exi4UaEW2au1jwUBwJK14xm3y11xfxmu3W3y261eBx_wHwUwa67EbUG2-azqwaW223908O3216xi4UK2K2WEjxK2B08-269wkopg6C13xecwBwWwjHDzUiBG2OUqwjVqwLwHwa211zU520XEaUcGy8qw",
                "__csr": "hc1gNQpb4guOsO5N4rfikaOhlgxsQ98BskB9qq9ElrPIvuzZHkSF5fla-BiPttJv_Ji9AHllQhFHVdGpsmFdaVO2bheXnHNzplLmBWO4AQqDBVoy8ZeuXCJ6GGnleqEy8SRuaBGl3unW8-8yrxirHAHKGiS9GQQjhkWJ2V49_xaAGzuK9ye8z9bjCye-8LGBt5iXBCBZxmueSESXUyAdCx3jG8V4um4kAqUCEJzm--Xnzd4CKcKdyElDmiVoOqdG8yo-4uUrxm78ylpFXCGh5HybAGbzV9UyQ-chkKFeqqHhEG59Gxt24cKql2UhwKyaK2_giAgmyKQeypF4uazEKeyEOEdFaDxCEyewKHKmeyoqAx6axe48K4omx2UvhUWjUix2fxmbWGUgwgoLGEmCxmbCzFodUd85i1gwo5QEsCHxe1ww8ufwxG0g69g2cAwj8-1ogJ90iA1Aw5twnUHgfoWbwQwTwlXxm5F98dFrg6py8b82BwxgB0km17gG78hwaG9xK0Do2Dx24Wo3qzE3gxy3ypxWm4SWykC0CE6u0je1Bwjk0hqu0L8lyU9E2jxe58uCwt8CcybyV81ro05hu8g4CE0FW0ipk0Jo9o0hcw2ME1ap-0iW00zS804p-1Rwiodo29wYy83ew8qlwwg2Jw5lx60uh0oE2cwdVCy981MU0XG5UfE1u8-0d0o0pxw3Caw-waG0Bk0eFwmU1F4u9gO8wJxK0VU34UeQ4o1740aWg1LU3Fxi0jGcwf61SxN4xN1Tg0uvC9Ag22w2eE31w1Mm0z404HEzU3YA42FO1sIGUF7ykbwOU882Rxq0OA0pe0rW02k24E2ryoy0iK0kow",
                "__hsdp": "g4f4A8xqezEJdEgy989qqirA32hAwh8oG3sbAq8BqNc4aeK9aJcNR6A6OaAB5VcWEaL4Ep5BsD8gIugpq1m8789QD4EO58lMrJIAIh3JEehMI5yBWqf58aANlQx5mlH2VG8goG6YW4jTsXjMwb8N2AKh8kCACAQtkCugyGgychAqaIXzyVNcmhO6Bb8nD6mxiWEiBTQ898AhmyOaCgRApp-QLSIj4Ehc9SBBIuDmigX8Bjl4uArJ58t9jIB39AFaJ7lEgea99jKGFIygN24y5Vv23hV9jJ4ePEwWi8KliybO4gGcpqjxp4PeyaliGzGUQwkcp2AimdiJem7UeoBomx2iCAhxqAiiuby3UJzFREyj6iUmHFBjwwGq8K210CzQlK6oizqixKaBQiHy4KQcyd4Q4SAnCDUihUf8GRzpGz4qEXz9EuzErjUjiyQ942Qbyk48C65V8n89y458iKm6EswZoSbgW9a3S4V8S3a5oqGUmx23Vx-5Aqauu544po-Q2im4QbNMy5U9-8AA80R8qLIMbVmIk2p91RG2d28F7hp9Q3Kt38hgpwl8aGmdpAA2EEdUuAzoZ4xa1awba4UGdho88B788AG2a32q5oO1wghxS2q5SQgiVxNrgswjUnwCxW2iewywrUfUao5mcG13wLxm4USfxAwvwk9k1440Wxm0J8pwjo20yoe40xU6m467p8uwhUk51w9j0r8fQ15waW2i0ou2K3q1KwpEb8vwlawYwXwdq3y3C3qE2nG582mwqoe87O0ie1Ewl8nyU5W484e7o7icAzo840R862u58461OxquEgK5U5m1Lw9i1byE4i0XEaGwWzk3u1vzUc8ao-8Uqxi5UcU2kzo5bwaurw7PyocGyU6m7E9UuUO3acw4owNwqu16w9213woE7a0RF4bwqocU7-3W",
                "__hblp": "0okdEkAl2UoVoeEqwTxByo7y488US48bFE9o2Pxa1lxq3m0ge3G0AVEcob-4e1lU8E4e48iBwzConxe2e6EPy8S8By8gAgK688EeEf85KcG7E3wzV99826wqaCwsEe8zwRwLg846o6C2-eUO3i7fwxK486a2i36U7K2-4i0Oxy10wTw8y2Dyofo4ibxu58dp41Qw8uq1Kwh9Etxi1hwkk1oiGeybwGS32q2e0ji4UvwGw_wTwdK3u3e1SAyEnwPxm0A8eEcEgzEaQcG13wmo5G17yo4G1GwZwoUlK1dw829wHwRwnUao5y4XguwhU886e3qEeE4y0z88o3FweW3q4UW1bwpEb8vwhWyqxS7EK2-0y84S7oqAwQwSHw9mEkzofES5E98hwGwIwUwv84S0Ro984e2DwEwzxi1qwNx66kE21Azo3Swo9UkxW2a1OxquEgK5U5m6U5e0woiwiUG14yU2mwiUW4oCEeER1W68S12xW1GyAcK8xi5UcU2kyo5rw8Gq5plw7PyocGwj898uwDxXz88oyu1xwCwOG5UGfxR1ibzUjhK1xwi827VE4e3e2p6wCwi8cVU2ky94bAwgo8E9UK0xoe8",
                "__sjsp": "g4f4A8xqezEJdEgy989qqirA32hAwhcmG3sbAq8BqPY49A-9ah4l2x0ABOmWJsACjeGtTPLbq6hpmDZ4T7A8vrbduxbmfyUhBDsx9VkDcpoDBA-fJ4hpEIHfFd1a5OafwEGmmhVHh5SfyJ29WhuEmgF6y44U9eHjO6gpm8KhbymAtd7l9z25A8z4CqaoEibDlR5AtxdoYpq5bB4FdZ22kmhp2FeCh9264Q5uEgx9F16ayUkld7CxiEcA6ErQ4VGFxt24EzBx-54gV38wjwCwyoy6QiaAK4GBKeUkgF2Aazkpem1pylwLjh66ki16DmBFcpS6V63m8K18zQlK3R0FDh8Za4UF4Q54Am4e4A1jg-9z9U4q364Q2N2U9oom7C4Q1cwtAeyiwp86q2K1Tg4m6k2im4QbNM889-4y0fe10qN8aag2Zgug6W2G0OAi1twdZ04IwrSQgiUwo0iO0So3LwNxAw72l031E6m460Dxgo2kM2Ig0jUw",
                "__comet_req": "15",
                "fb_dtsg": "NAftYZuU8CYUrUNLdnYvL4fxuLRvS-SmR8yY2dMuYeaNDbPJjXX2u2w:28:1752141799",
                "jazoest": "25615",
                "lsd": "wTDZUBVH-SkO66P4M4rD_S",
                "__spin_r": "1024844477",
                "__spin_b": "trunk",
                "__spin_t": "1752744844",
                "__crn": "comet.fbweb.CometProfileTimelineListViewRoute",
                "fb_api_caller_class": "RelayModern",
                "fb_api_req_friendly_name": "ProfileCometBulkStoryCurationMutation",
                "server_timestamps": "true",
                "doc_id": "24023103950672548",
                "variables": JSON.stringify({
                    "input": {
                        "story_actions": [{
                            "action":"DELETE",
                            "story_id": currentPostItem.id,
                            "story_location":"TIMELINE"
                        }],
                        "actor_id":currentPostItem.a,
                        "client_mutation_id":"1"
                    },
                    "afterTime":null,
                    "beforeTime":null,
                    "feedLocation":"TIMELINE",
                    "feedbackSource":0,
                    "focusCommentID":null,
                    "gridMediaWidth":230,
                    "includeGroupScheduledPosts":false,
                    "includeScheduledPosts":false,
                    "memorializedSplitTimeFilter":null,
                    "postedBy":null,
                    "privacy":null,
                    "privacySelectorRenderLocation":"COMET_STREAM",
                    "scale":1,
                    "taggedInOnly":null,
                    "omitPinnedPost":true,
                    "renderLocation":"timeline",
                    "useDefaultActor":false,
                    "trackingCode":null,
                    "is_professional_dashboard":false,
                    "__relay_internal__pv__GHLShouldChangeAdIdFieldNamerelayprovider":true,
                    "__relay_internal__pv__GHLShouldChangeSponsoredDataFieldNamerelayprovider":true,
                    "__relay_internal__pv__IsWorkUserrelayprovider":false,
                    "__relay_internal__pv__FBReels_deprecate_short_form_video_context_gkrelayprovider":true,
                    "__relay_internal__pv__FeedDeepDiveTopicPillThreadViewEnabledrelayprovider":false,
                    "__relay_internal__pv__CometImmersivePhotoCanUserDisable3DMotionrelayprovider":false,
                    "__relay_internal__pv__WorkCometIsEmployeeGKProviderrelayprovider":false,
                    "__relay_internal__pv__IsMergQAPollsrelayprovider":false,
                    "__relay_internal__pv__FBReelsMediaFooter_comet_enable_reels_ads_gkrelayprovider":false,
                    "__relay_internal__pv__CometUFIReactionsEnableShortNamerelayprovider":false,
                    "__relay_internal__pv__CometUFIShareActionMigrationrelayprovider":true,
                    "__relay_internal__pv__CometUFI_dedicated_comment_routable_dialog_gkrelayprovider":false,
                    "__relay_internal__pv__StoriesArmadilloReplyEnabledrelayprovider":true,
                    "__relay_internal__pv__FBReelsIFUTileContent_reelsIFUPlayOnHoverrelayprovider":false
                })
            })
            for (let tries = 0; tries < 3; tries++) {
                statusCode = await this.graphqlDelete(
                    'https://www.facebook.com/api/graphql/',
                    `https://www.facebook.com/profile.php?id=${this.account.facebookAccount?.accountID}`,
                    formData
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
