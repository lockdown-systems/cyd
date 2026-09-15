import type { XViewModel } from "../view_model";
import { sendXDeleteMutation } from "./operations";

/**
 * Delete a single like (unfavorite) via GraphQL API
 * @returns HTTP status code
 */
export async function deleteLikeItem(
  vm: XViewModel,
  ct0: string,
  tweetId: string,
): Promise<number> {
  return await sendXDeleteMutation(vm, ct0, "UnfavoriteTweet", {
    tweet_id: tweetId,
  });
}

/**
 * Delete a single bookmark via GraphQL API
 * @returns HTTP status code
 */
export async function deleteBookmarkItem(
  vm: XViewModel,
  ct0: string,
  tweetId: string,
): Promise<number> {
  return await sendXDeleteMutation(vm, ct0, "DeleteBookmark", {
    tweet_id: tweetId,
  });
}
