import type { XViewModel } from "../view_model";
import { XDeleteTweetsStartResponse } from "../../../../../shared_types";
import { AutomationErrorType } from "../../../automation_errors";
import { formatError } from "../../../util";
import { sendXDeleteMutation } from "./operations";

/**
 * Load the list of tweets to delete from the database
 * @returns The list of tweets to delete, or null if error occurred
 */
export async function deleteTweetsLoadList(
  vm: XViewModel,
  loadFunction: (accountId: number) => Promise<XDeleteTweetsStartResponse>,
  errorType: AutomationErrorType,
): Promise<XDeleteTweetsStartResponse | null> {
  try {
    const itemsToDelete = await loadFunction(vm.account.id);
    vm.log(
      "deleteTweetsLoadList",
      `found ${itemsToDelete.tweets.length} items to delete`,
    );
    return itemsToDelete;
  } catch (e) {
    await vm.error(errorType, {
      error: formatError(e as Error),
    });
    return null;
  }
}

/**
 * Delete a single tweet via GraphQL API
 * @returns HTTP status code
 */
export async function deleteTweetItem(
  vm: XViewModel,
  ct0: string,
  tweetId: string,
): Promise<number> {
  return await sendXDeleteMutation(vm, ct0, "DeleteTweet", {
    tweet_id: tweetId,
    dark_request: false,
  });
}

/**
 * Undo a single repost via GraphQL API
 *
 * X undoes a repost by naming the post that was reposted, not the repost
 * itself. A repost saved before Cyd recorded that identifier only carries its
 * own, so it is deleted the way Cyd has always deleted one.
 *
 * @returns HTTP status code
 */
export async function deleteRetweetItem(
  vm: XViewModel,
  ct0: string,
  retweetId: string,
  repostedTweetId: string | null,
): Promise<number> {
  if (!repostedTweetId) {
    return await deleteTweetItem(vm, ct0, retweetId);
  }

  return await sendXDeleteMutation(vm, ct0, "DeleteRetweet", {
    source_tweet_id: repostedTweetId,
  });
}
