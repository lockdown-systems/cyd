import type { XViewModel } from "../view_model";
import type { XTweetItemArchive } from "../../../../../shared_types";
import { AutomationErrorType } from "../../../automation_errors";
import { formatError } from "../../../util";

export async function archiveSaveTweet(
  vm: XViewModel,
  outputPath: string,
  tweetItem: XTweetItemArchive,
): Promise<boolean> {
  vm.log("archiveSaveTweet", `Archiving ${tweetItem.basename}`);

  // Check if the tweet is already archived
  if (
    await window.electron.archive.isPageAlreadySaved(
      outputPath,
      tweetItem.basename,
    )
  ) {
    vm.log("archiveSaveTweet", `Already archived ${tweetItem.basename}`);
    await window.electron.X.archiveTweetCheckDate(
      vm.account.id,
      tweetItem.tweetID,
    );
    vm.progress.tweetsArchived += 1;
    return true;
  }

  // Load the URL
  await vm.loadURLWithRateLimit(tweetItem.url);

  // Check if tweet is already deleted
  let alreadyDeleted = false;
  await vm.sleep(200);
  if (
    await vm.doesSelectorExist(
      'div[data-testid="primaryColumn"] div[data-testid="error-detail"]',
    )
  ) {
    vm.log("archiveSaveTweet", "tweet is already deleted");
    alreadyDeleted = true;
  }

  // Wait for the tweet to appear
  if (!alreadyDeleted) {
    try {
      await vm.waitForSelector('article[tabindex="-1"]', tweetItem.url, 10000);
      // Wait another second for replies, etc. to load
      await vm.sleep(1000);
    } catch (e) {
      vm.log("archiveSaveTweet", [
        "selector never appeared, but saving anyway",
        e,
      ]);
    }
  }

  // Save the page
  if (vm.webContentsID) {
    await window.electron.archive.savePage(
      vm.webContentsID,
      outputPath,
      tweetItem.basename,
    );
  } else {
    await vm.error(
      AutomationErrorType.x_runJob_archiveTweets_FailedToArchive,
      {
        message: "webContentsID is null",
      },
      {
        currentURL: vm.webview?.getURL(),
      },
      true,
    );
    return false;
  }

  // Update tweet's archivedAt date
  try {
    await window.electron.X.archiveTweet(vm.account.id, tweetItem.tweetID);
  } catch (e) {
    await vm.error(
      AutomationErrorType.x_runJob_archiveTweets_FailedToArchive,
      {
        error: formatError(e as Error),
      },
      {
        tweetItem: tweetItem,
        currentURL: vm.webview?.getURL(),
      },
      true,
    );
    return false;
  }

  // Update progress
  vm.progress.tweetsArchived += 1;
  vm.progress.newTweetsArchived += 1;
  return true;
}
