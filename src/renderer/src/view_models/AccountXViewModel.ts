import { BaseViewModel, TimeoutError, URLChangedError, InternetDownError } from './BaseViewModel';
import {
    XJob,
    XProgress, emptyXProgress,
    XTweetItem,
    XArchiveStartResponse,
    XIndexMessagesStartResponse,
    XRateLimitInfo, emptyXRateLimitInfo,
    XProgressInfo, emptyXProgressInfo,
    XDeleteTweetsStartResponse
} from '../../../shared_types';
import { PlausibleEvents } from "../types";
import { AutomationErrorType } from '../automation_errors';
import { APIErrorResponse, UserPremiumAPIResponse } from "../../../semiphemeral-api-client";

export enum State {
    Login = "login",
    Dashboard = "dashboard",
    DashboardDisplay = "dashboardDisplay",
    RunJobs = "runJobs",
    FinishedRunningJobs = "finishedRunningJobs",
}

export type XViewModelState = {
    state: State;
    action: string;
    actionString: string;
    actionFinishedString: string;
    progress: XProgress;
    jobs: XJob[];
    currentJobIndex: number;
}

export class AccountXViewModel extends BaseViewModel {
    public progress: XProgress = emptyXProgress();
    public rateLimitInfo: XRateLimitInfo = emptyXRateLimitInfo();
    public progressInfo: XProgressInfo = emptyXProgressInfo();
    public postXProgresResp: boolean | APIErrorResponse = false;
    public jobs: XJob[] = [];
    public currentJobIndex: number = 0;
    private isFirstRun: boolean = false;

    async init() {
        if (this.account && this.account.xAccount && this.account.xAccount.username) {
            this.state = State.Dashboard;
        } else {
            this.state = State.Login;
        }

        this.currentJobIndex = 0;

        super.init();
    }

    async setAction(action: string) {
        const actions = [];
        const finishedActions = [];

        this.action = action;
        switch (action) {
            case "archive":
                if (this.account.xAccount?.archiveTweets) {
                    actions.push("tweets");
                    finishedActions.push("tweets");
                }
                if (this.account.xAccount?.archiveLikes) {
                    actions.push("likes");
                    finishedActions.push("likes");
                }
                if (this.account.xAccount?.archiveDMs) {
                    actions.push("direct messages");
                    finishedActions.push("direct messages");
                }

                if (actions.length > 0) {
                    this.actionString = `I'm archiving your ${actions.join(" and ")}.`;
                    this.actionFinishedString = `I've finished archiving your ${finishedActions.join(" and ")}!`;
                } else {
                    this.actionString = "No archiving actions to perform.";
                    this.actionFinishedString = "No archiving actions were performed.";
                }
                break;
            case "delete":
                if (this.account.xAccount?.deleteTweets) {
                    actions.push("tweets");
                    finishedActions.push("tweets");
                }
                if (this.account.xAccount?.deleteRetweets) {
                    actions.push("retweets");
                    finishedActions.push("retweets");
                }
                if (this.account.xAccount?.deleteLikes) {
                    actions.push("likes");
                    finishedActions.push("likes");
                }
                if (this.account.xAccount?.deleteDMs) {
                    actions.push("direct messages");
                    finishedActions.push("direct messages");
                }

                if (actions.length > 0) {
                    this.actionString = `I'm deleting your ${actions.join(", ")}.`;
                    this.actionFinishedString = `I've finished deleting your ${finishedActions.join(", ")}!`;
                } else {
                    this.actionString = "No actions to perform.";
                    this.actionFinishedString = "No actions were performed.";
                }
                break;
        }
    }

    async startArchiving(forceIndex: boolean) {
        this.setAction("archive");

        const jobTypes = [];
        jobTypes.push("login");
        if (this.account.xAccount?.archiveTweets) {
            jobTypes.push("indexTweets");
            jobTypes.push("archiveTweets");
            if (forceIndex) {
                await window.electron.X.setConfig(this.account.id, "forceIndexTweets", "true");
            }
        }
        if (this.account.xAccount?.archiveLikes) {
            jobTypes.push("indexLikes");
            if (forceIndex) {
                await window.electron.X.setConfig(this.account.id, "forceIndexLikes", "true");
            }
        }
        if (this.account.xAccount?.archiveDMs) {
            jobTypes.push("indexConversations");
            jobTypes.push("indexMessages");
            if (forceIndex) {
                await window.electron.X.setConfig(this.account.id, "forceIndexDMs", "true");
            }
        }
        jobTypes.push("archiveBuild");

        try {
            this.jobs = await window.electron.X.createJobs(this.account.id, jobTypes);
            console.log("startArchiving", JSON.parse(JSON.stringify(this.jobs)));
        } catch (e) {
            await this.error(AutomationErrorType.x_unknownError, {
                exception: (e as Error).toString()
            }, {
                currentURL: this.webview.getURL()
            });
            return;
        }
        this.state = State.RunJobs;

        await window.electron.trackEvent(PlausibleEvents.X_ARCHIVE_STARTED, navigator.userAgent);
    }

    async startDeleting(forceIndex: boolean) {
        // Ensure the user has paid for Premium
        const authenticated = await this.api.ping();
        if (!authenticated) {
            this.emitter?.emit("show-sign-in");
            return;
        }

        // Check if the user has premium
        let userPremium: UserPremiumAPIResponse;
        const resp = await this.api.getUserPremium();
        if (resp && 'error' in resp === false) {
            userPremium = resp;
        } else {
            await window.electron.showMessage("Failed to check if you have Premium access. Please try again later.");
            return;
        }

        if (userPremium.premium_access === false) {
            await window.electron.showMessage("Deleting data from X is a Premium feature. Please upgrade to Premium to use this feature.");
            this.emitter?.emit("show-manage-account");
            return;
        }

        this.setAction("delete");

        const jobTypes = [];
        jobTypes.push("login");
        if (this.account.xAccount?.deleteTweets || this.account.xAccount?.deleteRetweets) {
            jobTypes.push("indexTweets");
            if (forceIndex) {
                await window.electron.X.setConfig(this.account.id, "forceIndexTweets", "true");
            }
        }
        if (this.account.xAccount?.deleteTweets) {
            jobTypes.push("deleteTweets");
        }
        if (this.account.xAccount?.deleteRetweets) {
            jobTypes.push("deleteRetweets");
        }
        if (this.account.xAccount?.deleteLikes) {
            jobTypes.push("indexLikes");
            jobTypes.push("deleteLikes");
            if (forceIndex) {
                await window.electron.X.setConfig(this.account.id, "forceIndexLikes", "true");
            }
        }
        if (this.account.xAccount?.deleteDMs) {
            jobTypes.push("indexConversations");
            jobTypes.push("indexMessages");
            jobTypes.push("deleteDMs");
            if (forceIndex) {
                await window.electron.X.setConfig(this.account.id, "forceIndexDMs", "true");
            }
        }
        jobTypes.push("archiveBuild");

        try {
            this.jobs = await window.electron.X.createJobs(this.account.id, jobTypes);
            console.log("startDeleting", JSON.parse(JSON.stringify(this.jobs)));
        } catch (e) {
            await this.error(AutomationErrorType.x_unknownError, {
                exception: (e as Error).toString()
            }, {
                currentURL: this.webview.getURL()
            });
            return;
        }
        this.state = State.RunJobs;

        await window.electron.trackEvent(PlausibleEvents.X_DELETE_STARTED, navigator.userAgent);
    }

    async reset() {
        this.progress = emptyXProgress();
        this.rateLimitInfo = emptyXRateLimitInfo();
        this.jobs = [];
        this.isFirstRun = false;
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

    async loadURLWithRateLimit(url: string, expectedURLs: string[] = []) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Reset the rate limit checker
            await window.electron.X.resetRateLimitInfo(this.account.id);

            // Load the URL
            try {
                await this.loadURL(url);
            } catch (e) {
                if (e instanceof InternetDownError) {
                    this.emitter?.emit(`cancel-automation-${this.account.id}`);
                } else {
                    await this.error(AutomationErrorType.x_loadURLError, {
                        url: url,
                        exception: (e as Error).toString()
                    }, {
                        currentURL: this.webview.getURL()
                    });
                }
                break;
            }
            await this.sleep(1000);
            await this.waitForLoadingToFinish();

            // Did the URL change?
            const newURL = this.webview.getURL();
            if (newURL != url) {
                let changedToUnexpected = true;
                for (const expectedURL of expectedURLs) {
                    if (newURL.startsWith(expectedURL)) {
                        changedToUnexpected = false;
                        break;
                    }
                }

                if (changedToUnexpected) {
                    this.error(AutomationErrorType.x_loadURLURLChanged, {
                        url: url,
                        newURL: newURL,
                        expectedURLs: expectedURLs
                    }, {
                        currentURL: this.webview.getURL()
                    });
                    break;
                }
            }

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
        await this.loadURLWithRateLimit("https://x.com/login", ["https://x.com/home", "https://x.com/i/flow/login"]);
        try {
            await this.waitForURL("https://x.com/home");
        } catch (e) {
            if (e instanceof URLChangedError) {
                await this.error(AutomationErrorType.X_login_URLChanged, {
                    exception: (e as Error).toString()
                }, {
                    currentURL: this.webview.getURL()
                });
            } else {
                await this.error(AutomationErrorType.X_login_WaitingForURLFailed, {
                    exception: (e as Error).toString()
                }, {
                    currentURL: this.webview.getURL()
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

        // Get the username
        this.log("login", "getting username");
        this.instructions = `You've logged in successfully. Now I'm scraping your username...`;
        await window.electron.X.getUsernameStart(this.account.id);
        await this.loadURLWithRateLimit("https://x.com/settings/account");
        await this.waitForSelector('a[href="/settings/your_twitter_data/account"]', "https://x.com/settings/account");
        const username = await window.electron.X.getUsername(this.account.id);
        await window.electron.X.getUsernameStop(this.account.id);

        if (!username) {
            const latestResponseData = await window.electron.X.getLatestResponseData(this.account.id);
            await this.error(AutomationErrorType.X_login_FailedToGetUsername, {}, {
                latestResponseData: latestResponseData,
                currentURL: this.webview.getURL()
            });
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

        await this.waitForPause();

        // Get the profile image
        this.log("login", "getting profile image");
        this.instructions = `You're logged in as **@${username}**. Now I'm scraping your profile image...`;

        await this.loadURLWithRateLimit(`https://x.com/${username}/photo`);
        await this.waitForSelector('div[aria-label="Image"]', `https://x.com/${username}/photo`);

        const profileImageURL = await this.getWebview()?.executeJavaScript(`document.querySelector('div[aria-label="Image"]').querySelector('img').src`);
        await window.electron.X.saveProfileImage(this.account.id, profileImageURL);
        this.log("login", ["saved profile image", profileImageURL]);

        this.emitter?.emit("account-updated", this.account);

        await this.waitForPause();
    }

    async finishJob(iJob: number) {
        this.jobs[iJob].finishedAt = new Date();
        this.jobs[iJob].status = "finished";
        this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
        await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));
        this.log("finishJob", this.jobs[iJob].jobType);
    }

    async errorJob(iJob: number) {
        this.jobs[iJob].finishedAt = new Date();
        this.jobs[iJob].status = "error";
        this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
        await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));
        this.log("errorJob", this.jobs[iJob].jobType);
    }

    async waitForSelectorDeleteDMs(selector: string, errorType: AutomationErrorType): Promise<boolean> {
        try {
            await this.waitForSelector(selector);
        } catch (e) {
            this.log("runJob", ["jobType=deleteDMs", "waitForSelectorDeleteDMs: selector never appeared", e]);
            if (e instanceof TimeoutError) {
                // Were we rate limited?
                this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                if (this.rateLimitInfo.isRateLimited) {
                    await this.waitForRateLimit();
                } else {
                    await this.error(errorType, {
                        exception: (e as Error).toString()
                    }, {
                        currentURL: this.webview.getURL()
                    })
                    return false;
                }
            } else if (e instanceof URLChangedError) {
                const newURL = this.webview.getURL();
                await this.error(AutomationErrorType.x_runJob_deleteDMs_URLChanged, {
                    newURL: newURL,
                    exception: (e as Error).toString()
                }, {
                    currentURL: this.webview.getURL()
                })
                return false;
            } else {
                await this.error(AutomationErrorType.x_runJob_deleteDMs_OtherError, {
                    exception: (e as Error).toString()
                }, {
                    currentURL: this.webview.getURL()
                })
                return false;
            }
        }
        return true;
    }

    async waitForSelectorWithinSelectorDeleteDMs(containerSelector: string, selector: string, errorType: AutomationErrorType): Promise<boolean> {
        try {
            await this.waitForSelectorWithinSelector(containerSelector, selector);
        } catch (e) {
            this.log("runJob", ["jobType=deleteDMs", "waitForSelectorWithinSelectorDeleteDMs: selector within selector never appeared", e]);
            if (e instanceof TimeoutError) {
                // Were we rate limited?
                this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                if (this.rateLimitInfo.isRateLimited) {
                    await this.waitForRateLimit();
                } else {
                    await this.error(errorType, {
                        exception: (e as Error).toString()
                    }, {
                        currentURL: this.webview.getURL()
                    })
                    return false;
                }
            } else if (e instanceof URLChangedError) {
                const newURL = this.webview.getURL();
                await this.error(AutomationErrorType.x_runJob_deleteDMs_URLChanged, {
                    newURL: newURL,
                    exception: (e as Error).toString()
                }, {
                    currentURL: this.webview.getURL()
                })
                return false;
            } else {
                await this.error(AutomationErrorType.x_runJob_deleteDMs_OtherError, {
                    exception: (e as Error).toString()
                }, {
                    currentURL: this.webview.getURL()
                })
                return false;
            }
        }
        return true;
    }

    async archiveSaveTweet(outputPath: string, tweetItem: XTweetItem): Promise<boolean> {
        console.log("Archiving", tweetItem.basename);

        // Check if the tweet is already archived
        if (await window.electron.archive.isPageAlreadySaved(outputPath, tweetItem.basename)) {
            console.log("Already archived", tweetItem.basename);
            await window.electron.X.archiveTweetCheckDate(this.account.id, tweetItem.tweetID);
            this.progress.tweetsArchived += 1;
            return true;
        }

        // Load the URL
        await this.loadURLWithRateLimit(tweetItem.url);

        // Save the page
        if (this.webContentsID) {
            await window.electron.archive.savePage(this.webContentsID, outputPath, tweetItem.basename);
        } else {
            this.error(AutomationErrorType.x_runJob_archiveTweets_FailedToArchive, {
                message: "webContentsID is null"
            }, {
                currentURL: this.webview.getURL()
            });
            return false;
        }

        // Update tweet's archivedAt date
        try {
            await window.electron.X.archiveTweet(this.account.id, tweetItem.tweetID);
        } catch (e) {
            await this.error(AutomationErrorType.x_runJob_archiveTweets_FailedToArchive, {
                exception: (e as Error).toString()
            }, {
                tweetItem: tweetItem,
                currentURL: this.webview.getURL()
            })
            return false;
        }

        // Update progress
        this.progress.tweetsArchived += 1;
        this.progress.newTweetsArchived += 1;
        return true;
    }

    async runJob(iJob: number) {
        await this.waitForPause();

        // Variables for use in the switch statement
        let errorTriggered = false;
        let alreadyDeleted = false;
        let tweetsToDelete: XDeleteTweetsStartResponse;
        let archiveStartResponse: XArchiveStartResponse;
        let indexMessagesStartResponse: XIndexMessagesStartResponse;

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
                await this.loadBlank();
                await window.electron.X.indexStart(this.account.id);
                await this.sleep(2000);

                // Start the progress
                this.progress.isIndexTweetsFinished = false;
                this.progress.tweetsIndexed = 0;
                await this.syncProgress();

                // Load the timeline and wait for tweets to appear
                await this.loadURLWithRateLimit("https://x.com/" + this.account.xAccount?.username + "/with_replies");
                await window.electron.X.resetRateLimitInfo(this.account.id);
                try {
                    await this.waitForSelector('article', "https://x.com/" + this.account.xAccount?.username + "/with_replies");
                } catch (e) {
                    this.log("runJob", ["jobType=indexTweets", "selector never appeared", e]);
                    if (e instanceof TimeoutError) {
                        // Were we rate limited?
                        this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
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
                        const newURL = this.webview.getURL();
                        await this.error(AutomationErrorType.x_runJob_indexTweets_URLChanged, {
                            newURL: newURL,
                            exception: (e as Error).toString()
                        }, {
                            currentURL: this.webview.getURL()
                        })
                        break;
                    } else {
                        await this.error(AutomationErrorType.x_runJob_indexTweets_OtherError, {
                            exception: (e as Error).toString()
                        }, {
                            currentURL: this.webview.getURL()
                        })
                        break;
                    }
                }

                while (this.progress.isIndexTweetsFinished === false) {
                    await this.waitForPause();

                    // Scroll to bottom
                    await window.electron.X.resetRateLimitInfo(this.account.id);
                    let moreToScroll = await this.scrollToBottom();
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.sleep(500);
                        await this.scrollToBottom();
                        await this.waitForRateLimit();
                        if (!await this.indexTweetsHandleRateLimit()) {
                            await this.error(AutomationErrorType.x_runJob_indexTweets_FailedToRetryAfterRateLimit, {}, {
                                currentURL: this.webview.getURL()
                            });
                            break;
                        }
                        await this.sleep(500);
                        moreToScroll = true;
                    }

                    // Parse so far
                    try {
                        this.progress = await window.electron.X.indexParseTweets(this.account.id, this.isFirstRun);
                    } catch (e) {
                        const latestResponseData = await window.electron.X.getLatestResponseData(this.account.id);
                        await this.error(AutomationErrorType.x_runJob_indexTweets_ParseTweetsError, {
                            exception: (e as Error).toString()
                        }, {
                            latestResponseData: latestResponseData,
                            currentURL: this.webview.getURL()
                        });
                        break;
                    }
                    this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                    await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));

                    // Check if we're done
                    if (!await window.electron.X.indexIsThereMore(this.account.id)) {
                        this.progress = await window.electron.X.indexTweetsFinished(this.account.id);
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

            case "archiveTweets":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

I'm archiving your tweets, starting with the oldest. This may take a while...
`;
                this.showAutomationNotice = true;

                // Initialize archiving of tweets
                try {
                    archiveStartResponse = await window.electron.X.archiveTweetsStart(this.account.id);
                } catch (e) {
                    await this.error(AutomationErrorType.x_runJob_archiveTweets_FailedToStart, {
                        exception: (e as Error).toString()
                    }, {
                        currentURL: this.webview.getURL()
                    })
                    break;
                }
                this.log('runJob', ["jobType=archiveTweets", "archiveStartResponse", archiveStartResponse]);

                // Start the progress
                this.progress.totalTweetsToArchive = archiveStartResponse.items.length;
                this.progress.tweetsArchived = 0;
                this.progress.newTweetsArchived = 0;

                // Archive the tweets
                errorTriggered = false;
                for (let i = 0; i < archiveStartResponse.items.length; i++) {
                    await this.waitForPause();

                    // Save the tweet
                    if (!await this.archiveSaveTweet(archiveStartResponse.outputPath, archiveStartResponse.items[i])) {
                        errorTriggered = true;
                        break;
                    }
                }

                if (errorTriggered) {
                    break;
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
                await this.loadBlank();
                await window.electron.X.indexStart(this.account.id);
                await this.sleep(2000);

                // Load the messages and wait for tweets to appear
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    await this.waitForPause();
                    await this.loadURLWithRateLimit("https://x.com/messages");
                    try {
                        await window.electron.X.resetRateLimitInfo(this.account.id);
                        await this.waitForSelector('div[aria-label="Timeline: Messages"]', "https://x.com/messages");
                        break;
                    } catch (e) {
                        this.log("runJob", ["jobType=indexConversations", "selector never appeared", e]);
                        if (e instanceof TimeoutError) {
                            // Were we rate limited?
                            this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
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
                            const newURL = this.webview.getURL();
                            await this.error(AutomationErrorType.x_runJob_indexConversations_URLChanged, {
                                newURL: newURL,
                                exception: (e as Error).toString(),
                                currentURL: this.webview.getURL()
                            })
                        } else {
                            await this.error(AutomationErrorType.x_runJob_indexConversations_OtherError, {
                                exception: (e as Error).toString(),
                                currentURL: this.webview.getURL()
                            })
                        }
                    }
                }

                while (this.progress.isIndexConversationsFinished === false) {
                    await this.waitForPause();

                    // Scroll to bottom
                    await window.electron.X.resetRateLimitInfo(this.account.id);
                    const moreToScroll = await this.scrollToBottom();
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.waitForRateLimit();
                    }

                    // Parse so far
                    try {
                        this.progress = await window.electron.X.indexParseConversations(this.account.id, this.isFirstRun);
                    } catch (e) {
                        const latestResponseData = await window.electron.X.getLatestResponseData(this.account.id);
                        await this.error(AutomationErrorType.x_runJob_indexConversations_ParseConversationsError, {
                            exception: (e as Error).toString()
                        }, {
                            latestResponseData: latestResponseData,
                            currentURL: this.webview.getURL()
                        });
                        break;
                    }
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
                await this.loadBlank();
                await window.electron.X.indexStart(this.account.id);
                await this.sleep(2000);

                // Load the conversations
                try {
                    indexMessagesStartResponse = await window.electron.X.indexMessagesStart(this.account.id, this.isFirstRun);
                } catch (e) {
                    await this.error(AutomationErrorType.x_runJob_indexMessages_FailedToStart, {
                        exception: (e as Error).toString()
                    }, {
                        currentURL: this.webview.getURL()
                    })
                    break;
                }
                this.log('runJob', ["jobType=indexMessages", "indexMessagesStartResponse", indexMessagesStartResponse]);

                // Start the progress
                this.progress.totalConversations = indexMessagesStartResponse?.totalConversations;
                this.progress.conversationMessagesIndexed = this.progress.totalConversations - indexMessagesStartResponse?.conversationIDs.length;
                await this.syncProgress();

                for (let i = 0; i < indexMessagesStartResponse.conversationIDs.length; i++) {
                    await this.waitForPause();

                    // Load the URL (in 3 tries)
                    let tries = 0;
                    let shouldSkip = false;
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        await this.waitForPause();

                        await this.loadURLWithRateLimit(`https://x.com/messages/${indexMessagesStartResponse.conversationIDs[i]}`);
                        try {
                            await this.waitForSelector('div[data-testid="DmActivityContainer"]', `https://x.com/messages/${indexMessagesStartResponse.conversationIDs[i]}`);
                            break;
                        } catch (e) {
                            this.log("runJob", ["jobType=indexMessages", "selector never appeared", e]);
                            if (e instanceof TimeoutError) {
                                // Were we rate limited?
                                this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                                if (this.rateLimitInfo.isRateLimited) {
                                    await this.waitForRateLimit();
                                } else {
                                    await this.error(AutomationErrorType.x_runJob_indexMessages_Timeout, {
                                        exception: (e as Error).toString(),
                                    }, {
                                        currentURL: this.webview.getURL()
                                    });
                                    break;
                                }
                            } else if (e instanceof URLChangedError) {
                                // Have we been redirected, such as to https://x.com/i/verified-get-verified ?
                                // This is a page that says: "Get X Premium to message this user"
                                if (this.webview && this.webview.getURL() != "https://x.com/messages/" + indexMessagesStartResponse.conversationIDs[i]) {
                                    this.log("runJob", ["jobType=indexMessages", "conversation is inaccessible, so skipping it"]);
                                    this.progress.conversationMessagesIndexed += 1;
                                    await this.syncProgress();
                                    shouldSkip = true;

                                    // Mark the conversation's shouldIndexMessages to false
                                    await window.electron.X.indexConversationFinished(this.account.id, indexMessagesStartResponse.conversationIDs[i]);
                                    break;
                                } else {
                                    await this.error(AutomationErrorType.x_runJob_indexMessages_URLChangedButDidnt, {
                                        exception: (e as Error).toString()
                                    }, {
                                        currentURL: this.webview.getURL()
                                    })
                                    break;
                                }
                            } else {
                                await this.error(AutomationErrorType.x_runJob_indexMessages_OtherError, {
                                    exception: (e as Error).toString()
                                }, {
                                    currentURL: this.webview.getURL()
                                });
                                break;
                            }

                            tries += 1;
                            if (tries >= 3) {
                                await this.error(AutomationErrorType.x_runJob_indexMessages_OtherError, {
                                    exception: (e as Error).toString()
                                }, {
                                    currentURL: this.webview.getURL()
                                });
                                break;
                            }
                        }
                    }

                    if (shouldSkip) {
                        continue;
                    }

                    await this.sleep(500);
                    await this.waitForLoadingToFinish();

                    while (this.progress.isIndexMessagesFinished === false) {
                        await this.waitForPause();

                        // Scroll to top
                        await window.electron.X.resetRateLimitInfo(this.account.id);
                        let moreToScroll = await this.scrollToTop('div[data-testid="DmActivityViewport"]');
                        this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                        if (this.rateLimitInfo.isRateLimited) {
                            await this.waitForRateLimit();
                            moreToScroll = true;
                        }

                        // Parse so far
                        try {
                            this.progress = await window.electron.X.indexParseMessages(this.account.id, this.isFirstRun);
                        } catch (e) {
                            const latestResponseData = await window.electron.X.getLatestResponseData(this.account.id);
                            await this.error(AutomationErrorType.x_runJob_indexMessages_ParseMessagesError, {
                                exception: (e as Error).toString()
                            }, {
                                latestResponseData: latestResponseData,
                                currentURL: this.webview.getURL()
                            });
                            break;
                        }
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
                    await window.electron.X.indexConversationFinished(this.account.id, indexMessagesStartResponse.conversationIDs[i]);
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
                try {
                    await window.electron.X.archiveBuild(this.account.id);
                } catch (e) {
                    await this.error(AutomationErrorType.x_runJob_archiveBuild_ArchiveBuildError, {
                        exception: (e as Error).toString()
                    })
                    break;
                }

                // Archiving complete
                await window.electron.trackEvent(PlausibleEvents.X_ARCHIVE_COMPLETED, navigator.userAgent);

                // Submit progress to the API
                this.progressInfo = await window.electron.X.getProgressInfo(this.account?.id);
                this.log("runJob", ["jobType=archiveBuild", "progressInfo", JSON.parse(JSON.stringify(this.progressInfo))]);
                this.postXProgresResp = await this.api.postXProgress({
                    account_uuid: this.progressInfo.accountUUID,
                    total_tweets_archived: this.progressInfo.totalTweetsArchived,
                    total_messages_indexed: this.progressInfo.totalMessagesIndexed,
                    total_tweets_deleted: this.progressInfo.totalTweetsDeleted,
                    total_retweets_deleted: this.progressInfo.totalRetweetsDeleted,
                    total_likes_deleted: this.progressInfo.totalLikesDeleted,
                    total_conversations_deleted: this.progressInfo.totalConversationsDeleted,
                    total_messages_deleted: this.progressInfo.totalMessagesDeleted
                }, this.deviceInfo?.valid ? true : false)
                if (this.postXProgresResp !== true && this.postXProgresResp !== false && this.postXProgresResp.error) {
                    // Silently log the error and continue
                    this.log("runJob", ["jobType=archiveBuild", "failed to post progress to the API", this.postXProgresResp.message]);
                }

                await this.finishJob(iJob);
                break;

            case "indexLikes":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

Hang on while I scroll down to your earliest likes that I've seen.
`;
                this.showAutomationNotice = true;

                // Check if this is the first time indexing likes has happened in this account
                if (this.forceIndexEverything || await window.electron.X.getLastFinishedJob(this.account.id, "indexLikes") == null) {
                    this.isFirstRun = true;
                }

                // Start monitoring network requests
                await this.loadBlank();
                await window.electron.X.indexStart(this.account.id);
                await this.sleep(2000);

                // Start the progress
                this.progress.isIndexLikesFinished = false;
                this.progress.likesIndexed = 0;
                await this.syncProgress();

                // Load the likes and wait for tweets to appear
                await this.waitForPause();
                await this.loadURLWithRateLimit("https://x.com/" + this.account.xAccount?.username + "/likes");
                await window.electron.X.resetRateLimitInfo(this.account.id);
                try {
                    await this.waitForSelector('article', "https://x.com/" + this.account.xAccount?.username + "/likes");
                } catch (e) {
                    this.log("runJob", ["jobType=indexLikes", "selector never appeared", e]);
                    if (e instanceof TimeoutError) {
                        // Were we rate limited?
                        this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
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
                        const newURL = this.webview.getURL();
                        await this.error(AutomationErrorType.x_runJob_indexLikes_URLChanged, {
                            newURL: newURL,
                            exception: (e as Error).toString()
                        }, {
                            currentURL: this.webview.getURL()
                        })
                        break;
                    } else {
                        await this.error(AutomationErrorType.x_runJob_indexLikes_OtherError, {
                            exception: (e as Error).toString()
                        }, {
                            currentURL: this.webview.getURL()
                        })
                        break;
                    }
                }

                while (this.progress.isIndexLikesFinished === false) {
                    await this.waitForPause();

                    // Scroll to bottom
                    await window.electron.X.resetRateLimitInfo(this.account.id);
                    let moreToScroll = await this.scrollToBottom();
                    this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                    if (this.rateLimitInfo.isRateLimited) {
                        await this.sleep(500);
                        await this.scrollToBottom();
                        await this.waitForRateLimit();
                        if (!await this.indexTweetsHandleRateLimit()) {
                            await this.error(AutomationErrorType.x_runJob_indexLikes_FailedToRetryAfterRateLimit, {}, {
                                currentURL: this.webview.getURL()
                            });
                            break;
                        }
                        await this.sleep(500);
                        moreToScroll = true;
                    }

                    // Parse so far
                    try {
                        this.progress = await window.electron.X.indexParseLikes(this.account.id, this.isFirstRun);
                    } catch (e) {
                        const latestResponseData = await window.electron.X.getLatestResponseData(this.account.id);
                        await this.error(AutomationErrorType.x_runJob_indexLikes_ParseTweetsError, {
                            exception: (e as Error).toString()
                        }, {
                            latestResponseData: latestResponseData,
                            currentURL: this.webview.getURL()
                        });
                        break;
                    }
                    this.jobs[iJob].progressJSON = JSON.stringify(this.progress);
                    await window.electron.X.updateJob(this.account.id, JSON.stringify(this.jobs[iJob]));

                    // Check if we're done
                    if (!await window.electron.X.indexIsThereMore(this.account.id)) {
                        this.progress = await window.electron.X.indexLikesFinished(this.account.id);
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

            case "deleteTweets":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

I'm deleting your tweets based on your criteria, starting with the earliest.
`;
                this.showAutomationNotice = true;

                // Load the tweets to delete
                try {
                    tweetsToDelete = await window.electron.X.deleteTweetsStart(this.account.id);
                } catch (e) {
                    await this.error(AutomationErrorType.x_runJob_deleteTweets_FailedToStart, {
                        exception: (e as Error).toString()
                    }, {
                        currentURL: this.webview.getURL()
                    })
                    break;
                }
                this.log('runJob', ["jobType=deleteTweets", "deleteTweetsStartResponse", tweetsToDelete]);

                // Start the progress
                this.progress.totalTweetsToDelete = tweetsToDelete.tweets.length;
                this.progress.tweetsDeleted = 0;
                this.progress.tweetsArchived = 0;
                this.progress.newTweetsArchived = 0;
                await this.syncProgress();

                errorTriggered = false;
                for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
                    // Load the URL
                    await this.loadURLWithRateLimit(`https://x.com/${this.account.xAccount?.username}/status/${tweetsToDelete.tweets[i].tweetID}`);
                    await this.sleep(200);

                    await this.waitForPause();

                    if (this.account.xAccount?.deleteTweetsArchiveEnabled) {
                        // Archive the tweet
                        if (!await this.archiveSaveTweet(await window.electron.X.archiveTweetsOutputPath(this.account.id), tweetsToDelete.tweets[i])) {
                            errorTriggered = true;
                            break;
                        }
                    }

                    await this.waitForPause();

                    // Wait for the menu button to appear
                    try {
                        await this.waitForSelector('article:has(+ div[data-testid="inline_reply_offscreen"]) button[aria-label="More"]');
                    } catch (e) {
                        await this.error(AutomationErrorType.x_runJob_deleteTweets_WaitForMenuButtonFailed, {
                            exception: (e as Error).toString()
                        }), {
                            currentURL: this.webview.getURL()
                        };
                        errorTriggered = true;
                        break;
                    }
                    await this.sleep(200);

                    // Click the menu button
                    await this.scriptClickElement('article:has(+ div[data-testid="inline_reply_offscreen"]) button[aria-label="More"]');

                    // Wait for the menu to appear
                    try {
                        await this.waitForSelector('div[role="menu"] div[role="menuitem"]:first-of-type');
                    } catch (e) {
                        await this.error(AutomationErrorType.x_runJob_deleteTweets_WaitForMenuFailed, {
                            exception: (e as Error).toString()
                        }, {
                            currentURL: this.webview.getURL()
                        });
                        errorTriggered = true;
                        break;
                    }
                    await this.sleep(200);

                    // Click the delete button
                    await this.scriptClickElement('div[role="menu"] div[role="menuitem"]:first-of-type');

                    // Wait for the delete confirmation popup to appear
                    try {
                        await this.waitForSelector('div[role="group"] button[data-testid="confirmationSheetConfirm"]');
                    } catch (e) {
                        await this.error(AutomationErrorType.x_runJob_deleteTweets_WaitForDeleteConfirmationFailed, {
                            exception: (e as Error).toString()
                        }, {
                            currentURL: this.webview.getURL()
                        });
                        errorTriggered = true;
                        break;
                    }
                    await this.sleep(200);

                    // Click delete confirmation
                    await this.scriptClickElement('div[role="group"] button[data-testid="confirmationSheetConfirm"]');
                    await this.sleep(200);

                    // Update the tweet's deletedAt date
                    try {
                        await window.electron.X.deleteTweet(this.account.id, tweetsToDelete.tweets[i].tweetID);
                    } catch (e) {
                        await this.error(AutomationErrorType.x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp, {
                            exception: (e as Error).toString()
                        }, {
                            tweet: tweetsToDelete.tweets[i],
                            index: i,
                            currentURL: this.webview.getURL()
                        })
                        errorTriggered = true;
                        break;
                    }

                    this.progress.tweetsDeleted += 1;
                    await this.syncProgress();
                }

                if (errorTriggered) {
                    break;
                }

                await this.finishJob(iJob);
                break;

            case "deleteRetweets":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

I'm deleting your retweets, starting with the earliest.
`;
                this.showAutomationNotice = true;

                // Load the retweets to delete
                try {
                    tweetsToDelete = await window.electron.X.deleteRetweetsStart(this.account.id);
                } catch (e) {
                    await this.error(AutomationErrorType.x_runJob_deleteTweets_FailedToStart, {
                        exception: (e as Error).toString()
                    }, {
                        currentURL: this.webview.getURL()
                    })
                    break;
                }
                this.log('runJob', ["jobType=deleteRetweets", "deleteRetweetsStartResponse", tweetsToDelete]);

                // Start the progress
                this.progress.totalRetweetsToDelete = tweetsToDelete.tweets.length;
                this.progress.retweetsDeleted = 0;
                await this.syncProgress();

                for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
                    alreadyDeleted = false;

                    // Load the URL
                    await this.loadURLWithRateLimit(`https://x.com/${tweetsToDelete.tweets[i].username}/status/${tweetsToDelete.tweets[i].tweetID}`);
                    await this.sleep(200);

                    await this.waitForPause();

                    // Wait for the retweet menu button to appear
                    try {
                        await this.waitForSelector('article:has(+ div[data-testid="inline_reply_offscreen"]) button[data-testid="unretweet"]');
                    } catch (e) {
                        // If it doesn't appear, let's assume this retweet was already deleted
                        alreadyDeleted = true;
                    }
                    await this.sleep(200);

                    if (!alreadyDeleted) {
                        // Click the retweet menu button
                        await this.scriptClickElement('article:has(+ div[data-testid="inline_reply_offscreen"]) button[data-testid="unretweet"]');

                        // Wait for the unretweet menu to appear
                        try {
                            await this.waitForSelector('div[role="menu"] div[role="menuitem"]:first-of-type');
                        } catch (e) {
                            await this.error(AutomationErrorType.x_runJob_deleteRetweets_WaitForMenuFailed, {
                                exception: (e as Error).toString()
                            }, {
                                currentURL: this.webview.getURL()
                            });
                            break;
                        }
                        await this.sleep(200);

                        // Click the delete button
                        await this.scriptClickElement('div[role="menu"] div[role="menuitem"]:first-of-type');
                        await this.sleep(200);
                    } else {
                        console.log("Already unretweeted", tweetsToDelete.tweets[i].tweetID);
                    }

                    // Mark the tweet as deleted
                    try {
                        // Deleting retweets uses the same deleteTweet IPC function as deleting tweets
                        await window.electron.X.deleteTweet(this.account.id, tweetsToDelete.tweets[i].tweetID);
                    } catch (e) {
                        await this.error(AutomationErrorType.x_runJob_deleteRetweets_FailedToUpdateDeleteTimestamp, {
                            exception: (e as Error).toString()
                        }, {
                            tweet: tweetsToDelete.tweets[i],
                            index: i,
                            currentURL: this.webview.getURL()
                        })
                        break;
                    }

                    this.progress.retweetsDeleted += 1;
                    await this.syncProgress();
                }

                await this.finishJob(iJob);
                break;

            case "deleteLikes":
                this.showBrowser = true;
                this.instructions = `
**${this.actionString}**

I'm deleting your likes, starting with the earliest.
`;
                this.showAutomationNotice = true;

                // Load the likes to delete
                try {
                    tweetsToDelete = await window.electron.X.deleteLikesStart(this.account.id);
                } catch (e) {
                    await this.error(AutomationErrorType.x_runJob_deleteLikes_FailedToStart, {
                        exception: (e as Error).toString()
                    }, {
                        currentURL: this.webview.getURL()
                    })
                    break;
                }
                this.log('runJob', ["jobType=deleteLikes", "deleteLikesStartResponse", tweetsToDelete]);

                // Start the progress
                this.progress.totalLikesToDelete = tweetsToDelete.tweets.length;
                this.progress.likesDeleted = 0;
                await this.syncProgress();

                for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
                    alreadyDeleted = false;

                    // Load the URL
                    await this.loadURLWithRateLimit(`https://x.com/${tweetsToDelete.tweets[i].username}/status/${tweetsToDelete.tweets[i].tweetID}`);
                    await this.sleep(200);

                    await this.waitForPause();

                    // Wait for the unlike button to appear
                    try {
                        await this.waitForSelector('article:has(+ div[data-testid="inline_reply_offscreen"]) button[data-testid="unlike"]');
                    } catch (e) {
                        // If it doesn't appear, let's assume this like was already deleted
                        alreadyDeleted = true;
                    }
                    await this.sleep(200);

                    if (!alreadyDeleted) {
                        // Click the unlike button
                        await this.scriptClickElement('article:has(+ div[data-testid="inline_reply_offscreen"]) button[data-testid="unlike"]');
                        await this.sleep(200);
                    } else {
                        console.log("Already unliked", tweetsToDelete.tweets[i].tweetID);
                    }


                    // Mark the tweet as deleted
                    try {
                        // Deleting likes uses the same deleteTweet IPC function as deleting tweets
                        await window.electron.X.deleteTweet(this.account.id, tweetsToDelete.tweets[i].tweetID);
                    } catch (e) {
                        await this.error(AutomationErrorType.x_runJob_deleteLikes_FailedToUpdateDeleteTimestamp, {
                            exception: (e as Error).toString()
                        }, {
                            tweet: tweetsToDelete.tweets[i],
                            index: i,
                            currentURL: this.webview.getURL()
                        })
                        break;
                    }

                    this.progress.likesDeleted += 1;
                    await this.syncProgress();
                }

                await this.finishJob(iJob);
                break;

            case "deleteDMs":
                this.showBrowser = true;
                this.instructions = `**${this.actionString}**

I'm deleting all of your direct message conversations, start with the most recent.`;
                this.showAutomationNotice = true;

                // Start the progress
                await this.syncProgress();
                this.progress = await window.electron.X.deleteDMsStart(this.account.id);

                if (this.progress.totalConversationsToDelete == 0) {
                    await this.finishJob(iJob);
                    break;
                }

                // Load the messages and wait for tweets to appear
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    await this.loadURLWithRateLimit("https://x.com/messages");
                    try {
                        await window.electron.X.resetRateLimitInfo(this.account.id);
                        await this.waitForSelector('div[aria-label="Timeline: Messages"]', "https://x.com/messages");
                        break;
                    } catch (e) {
                        this.log("runJob", ["jobType=deleteDMs", "selector never appeared", e]);
                        if (e instanceof TimeoutError) {
                            // Were we rate limited?
                            this.rateLimitInfo = await window.electron.X.isRateLimited(this.account.id);
                            if (this.rateLimitInfo.isRateLimited) {
                                await this.waitForRateLimit();
                            } else {
                                // Assume that there are no conversations
                                await this.waitForLoadingToFinish();
                                this.progress.isDeleteDMsFinished = true;
                                await this.syncProgress();
                                break;
                            }
                        } else if (e instanceof URLChangedError) {
                            const newURL = this.webview.getURL();
                            await this.error(AutomationErrorType.x_runJob_deleteDMs_URLChanged, {
                                newURL: newURL,
                                exception: (e as Error).toString(),
                                currentURL: this.webview.getURL()
                            })
                        } else {
                            await this.error(AutomationErrorType.x_runJob_deleteDMs_OtherError, {
                                exception: (e as Error).toString(),
                                currentURL: this.webview.getURL()
                            })
                        }
                    }
                }

                errorTriggered = false;
                if (!this.progress.isDeleteDMsFinished) {
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        await this.waitForPause();

                        // Wait for conversation selector
                        if (!await this.waitForSelectorDeleteDMs(
                            'div[data-testid="conversation"]',
                            AutomationErrorType.x_runJob_deleteDMs_WaitForConversationsFailed
                        )) {
                            errorTriggered = true;
                            break;
                        }

                        // Mouseover the first conversation
                        if (!await this.scriptMouseoverElementFirst('div[data-testid="conversation"]')) {
                            await this.error(AutomationErrorType.x_runJob_deleteDMs_MouseoverFailed, {}, {
                                currentURL: this.webview.getURL()
                            });
                            errorTriggered = true;
                            break;
                        }

                        // Wait for menu button selector
                        if (!await this.waitForSelectorWithinSelectorDeleteDMs(
                            'div[data-testid="conversation"]',
                            'button[aria-label="More"]',
                            AutomationErrorType.x_runJob_deleteDMs_WaitForMenuButtonFailed
                        )) {
                            errorTriggered = true;
                            break;
                        }

                        // Click the menu button
                        if (!await this.scriptClickElementWithinElementFirst('div[data-testid="conversation"]', 'button[aria-label="More"]')) {
                            await this.error(AutomationErrorType.x_runJob_deleteDMs_ClickMenuFailed, {}, {
                                currentURL: this.webview.getURL()
                            });
                            errorTriggered = true;
                            break;
                        }

                        // Wait for delete button selector
                        if (!await this.waitForSelectorDeleteDMs(
                            'div[data-testid="Dropdown"] div[role="menuitem"]:last-of-type',
                            AutomationErrorType.x_runJob_deleteDMs_WaitForDeleteButtonFailed
                        )) {
                            errorTriggered = true;
                            break;
                        }

                        // Click the delete button
                        if (!await this.scriptClickElement('div[data-testid="Dropdown"] div[role="menuitem"]:last-of-type')) {
                            await this.error(AutomationErrorType.x_runJob_deleteDMs_ClickDeleteFailed, {}, {
                                currentURL: this.webview.getURL()
                            });
                            errorTriggered = true;
                            break;
                        }

                        // Wait for delete confirm selector
                        if (!await this.waitForSelectorDeleteDMs(
                            'button[data-testid="confirmationSheetConfirm"]',
                            AutomationErrorType.x_runJob_deleteDMs_WaitForConfirmButtonFailed
                        )) {
                            errorTriggered = true;
                            break;
                        }

                        // Click the confirm button
                        if (!await this.scriptClickElement('button[data-testid="confirmationSheetConfirm"]')) {
                            await this.error(AutomationErrorType.x_runJob_deleteDMs_ClickConfirmFailed, {}, {
                                currentURL: this.webview.getURL()
                            });
                            errorTriggered = true;
                            break;
                        }

                        await this.sleep(500);
                        await this.waitForLoadingToFinish();

                        // Update the progress
                        this.progress = await window.electron.X.getProgress(this.account.id);

                        // Have we deleted all conversations?
                        if (this.progress.conversationsDeleted == this.progress.totalConversationsToDelete) {
                            break;
                        }
                    }
                }

                if (errorTriggered) {
                    break;
                }

                await this.finishJob(iJob);
                break;
        }
    }

    async run() {
        this.log("run", `running state: ${this.state}`);
        try {
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
                    // i is starting at currentJobIndex instead of 0, in case we restored state
                    for (let i = this.currentJobIndex; i < this.jobs.length; i++) {
                        this.currentJobIndex = i;
                        try {
                            await this.runJob(i);
                        } catch (e) {
                            await this.error(AutomationErrorType.x_runJob_UnknownError, {
                                exception: (e as Error).toString()
                            }, {
                                currentURL: this.webview.getURL()
                            });
                            break;
                        }
                    }
                    this.currentJobIndex = 0;

                    this.state = State.FinishedRunningJobs;
                    this.showBrowser = false;
                    await this.loadURL("about:blank");

                    this.instructions = `**${this.actionFinishedString}**`;
                    break;
            }
        } catch (e) {
            await this.error(AutomationErrorType.x_runError, {
                exception: (e as Error).toString(),
                state: this.state,
                jobs: this.jobs,
                currentJobIndex: this.currentJobIndex,
            }, {
                currentURL: this.webview.getURL()
            });
        }
    }

    saveState(): XViewModelState {
        return {
            "state": this.state as State,
            "action": this.action,
            "actionString": this.actionString,
            "actionFinishedString": this.actionFinishedString,
            "progress": this.progress,
            "jobs": this.jobs,
            "currentJobIndex": this.currentJobIndex,
        }
    }

    restoreState(state: XViewModelState) {
        this.state = state.state;
        this.action = state.action;
        this.actionString = state.actionString;
        this.actionFinishedString = state.actionFinishedString;
        this.progress = state.progress;
        this.jobs = state.jobs;
        this.currentJobIndex = state.currentJobIndex;
    }
}