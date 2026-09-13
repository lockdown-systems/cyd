import log from "electron-log/main";

import {
  NodeOAuthClient,
  type NodeOAuthClientFromMetadataOptions,
} from "@atproto/oauth-client-node";

import { blueskyOAuthClientID } from "./constants";
import { blueskyOAuthSessionStore, blueskyOAuthStateStore } from "./store";

/**
 * The one `NodeOAuthClient` in Cyd.
 *
 * Client metadata resolution, the state store, and the session store are
 * settled here and nowhere else, so a platform cannot accidentally authorize
 * against different metadata or write a session somewhere the other platforms
 * cannot read it. The client is cached because fetching client metadata is a
 * network round trip, and every caller wants the same one.
 */
let client: NodeOAuthClient | null = null;
let pending: Promise<NodeOAuthClient> | null = null;

const buildClient = async (): Promise<NodeOAuthClient> => {
  const options: NodeOAuthClientFromMetadataOptions = {
    clientId: blueskyOAuthClientID(),
    stateStore: blueskyOAuthStateStore(),
    sessionStore: blueskyOAuthSessionStore(),
  };
  const clientMetadata = await NodeOAuthClient.fetchMetadata(options);
  return new NodeOAuthClient({ ...options, clientMetadata });
};

export const getBlueskyOAuthClient = async (): Promise<NodeOAuthClient> => {
  if (client) {
    return client;
  }
  if (!pending) {
    // Two callers racing here must not fetch metadata twice, and a failure
    // must not leave a rejected promise cached forever.
    pending = buildClient()
      .then((built) => {
        client = built;
        return built;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
};

/**
 * Drop the cached client so the next caller builds a fresh one. Cyd reaches
 * for this when a client turns out to be unusable, and tests use it to keep
 * one test's client out of the next.
 */
export const resetBlueskyOAuthClient = (): void => {
  client = null;
  pending = null;
  log.info("blueskyOAuth: discarded the cached OAuth client");
};
