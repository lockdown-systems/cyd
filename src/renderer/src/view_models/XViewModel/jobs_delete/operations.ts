import type { XViewModel } from "../view_model";

// The GraphQL mutations the delete jobs issue, keyed by operation name. Each
// carries the identifier X rotates whenever it redeploys, and the referrer its
// own client sends. Seeded from the capture of 2026-09-14; see
// docs/x-capture/findings-20260914.md, findings 8 and 11.
export type XDeleteOperationName =
  | "DeleteTweet"
  | "DeleteRetweet"
  | "UnfavoriteTweet"
  | "DeleteBookmark";

export const X_DELETE_OPERATION_SEEDS: Record<
  XDeleteOperationName,
  { queryID: string; referrer: (username: string) => string }
> = {
  DeleteTweet: {
    queryID: "nxpZCY2K-I6QoFHAHeojFQ",
    referrer: (username) => `https://x.com/${username}`,
  },
  DeleteRetweet: {
    queryID: "ZyZigVsNiFO6v1dEks1eWg",
    referrer: (username) => `https://x.com/${username}/reposts`,
  },
  UnfavoriteTweet: {
    queryID: "ZYKSe-w7KEslx3JhSIk5LA",
    referrer: () => "https://x.com/i/history/likes",
  },
  DeleteBookmark: {
    queryID: "Wlmlj2-xzyS1GN3a6cj-mQ",
    referrer: () => "https://x.com/i/history",
  },
};

export type XDeleteOperation = {
  url: string;
  queryID: string;
  referrer: string;
};

/**
 * Where to send a delete mutation, and what identifier to send it with.
 *
 * X's own client names the current identifier in every request it makes, so an
 * identifier observed this session wins over the seeded constant and a
 * rotation stops being an outage. A cold-start delete run, having observed
 * nothing yet, still relies on the seeds.
 */
export function resolveXDeleteOperation(
  name: XDeleteOperationName,
  username: string,
  observedQueryIDs: Record<string, string>,
): XDeleteOperation {
  const queryID =
    observedQueryIDs[name] || X_DELETE_OPERATION_SEEDS[name].queryID;
  return {
    url: `https://x.com/i/api/graphql/${queryID}/${name}`,
    queryID,
    referrer: X_DELETE_OPERATION_SEEDS[name].referrer(username),
  };
}

/**
 * Issue one delete mutation
 * @returns HTTP status code
 */
export async function sendXDeleteMutation(
  vm: XViewModel,
  ct0: string,
  name: XDeleteOperationName,
  variables: Record<string, unknown>,
): Promise<number> {
  const operation = resolveXDeleteOperation(
    name,
    vm.account.xAccount?.username || "",
    await window.electron.X.getObservedGraphqlQueryIDs(vm.account.id),
  );

  return await vm.graphqlDelete(
    ct0,
    operation.url,
    operation.referrer,
    JSON.stringify({ variables, queryId: operation.queryID }),
  );
}
