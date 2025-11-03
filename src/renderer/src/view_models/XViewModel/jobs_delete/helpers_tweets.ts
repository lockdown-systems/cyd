import type { XViewModel } from "../view_model";
import { XDeleteTweetsStartResponse } from "../../../../../shared_types";
import { AutomationErrorType } from "../../../automation_errors";
import { formatError } from "../../../util";

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
  username: string,
): Promise<number> {
  return await vm.graphqlDelete(
    ct0,
    "https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet",
    `https://x.com/${username}/with_replies`,
    JSON.stringify({
      variables: {
        tweet_id: tweetId,
        dark_request: false,
      },
      queryId: "VaenaVgh5q5ih7kvyVjgtg",
    }),
  );
}

/**
 * Delete a single retweet via GraphQL API (uses same endpoint as DeleteTweet)
 * @returns HTTP status code
 */
export async function deleteRetweetItem(
  vm: XViewModel,
  ct0: string,
  retweetId: string,
  username: string,
): Promise<number> {
  return await vm.graphqlDelete(
    ct0,
    "https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet",
    `https://x.com/${username}/with_replies`,
    JSON.stringify({
      variables: {
        tweet_id: retweetId,
        dark_request: false,
      },
      queryId: "VaenaVgh5q5ih7kvyVjgtg",
    }),
  );
}
