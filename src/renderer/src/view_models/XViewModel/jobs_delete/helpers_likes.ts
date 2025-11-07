import type { XViewModel } from "../view_model";

/**
 * Delete a single like (unfavorite) via GraphQL API
 * @returns HTTP status code
 */
export async function deleteLikeItem(
  vm: XViewModel,
  ct0: string,
  tweetId: string,
  username: string,
): Promise<number> {
  return await vm.graphqlDelete(
    ct0,
    "https://x.com/i/api/graphql/ZYKSe-w7KEslx3JhSIk5LA/UnfavoriteTweet",
    `https://x.com/${username}/likes`,
    JSON.stringify({
      variables: {
        tweet_id: tweetId,
      },
      queryId: "ZYKSe-w7KEslx3JhSIk5LA",
    }),
  );
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
  return await vm.graphqlDelete(
    ct0,
    "https://x.com/i/api/graphql/Wlmlj2-xzyS1GN3a6cj-mQ/DeleteBookmark",
    "https://x.com/i/bookmarks",
    JSON.stringify({
      variables: {
        tweet_id: tweetId,
      },
      queryId: "Wlmlj2-xzyS1GN3a6cj-mQ",
    }),
  );
}
