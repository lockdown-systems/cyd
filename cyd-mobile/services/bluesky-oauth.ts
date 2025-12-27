import AsyncStorage from "@react-native-async-storage/async-storage";
import { Agent } from "@atproto/api";
import type { AuthorizeOptions } from "@atproto/oauth-client";
import {
  NodeOAuthClient,
  type NodeOAuthClientFromMetadataOptions,
  type NodeSavedSession,
  type NodeSavedState,
} from "@atproto/oauth-client-node";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { saveAuthenticatedBlueskyAccount } from "@/database/accounts";

const STATE_PREFIX = "@cyd/bluesky/state/";
const SESSION_PREFIX = "@cyd/bluesky/session/";
const CLIENT_METADATA_PATH = "bluesky/client-metadata.json";
const PROD_HOST = "api.cyd.social";
const DEV_HOST = "dev-api.cyd.social";

let clientPromise: Promise<NodeOAuthClient> | null = null;
type OAuthRedirectUri = NonNullable<AuthorizeOptions["redirect_uri"]>;

export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

async function getClient(): Promise<NodeOAuthClient> {
  if (!clientPromise) {
    clientPromise = initClient();
  }

  return clientPromise;
}

async function initClient(): Promise<NodeOAuthClient> {
  const host = __DEV__ ? DEV_HOST : PROD_HOST;
  const clientId =
    `https://${host}/${CLIENT_METADATA_PATH}` as NodeOAuthClientFromMetadataOptions["clientId"];

  const options: NodeOAuthClientFromMetadataOptions = {
    clientId,
    stateStore: {
      set: async (key: string, value: NodeSavedState) => {
        await AsyncStorage.setItem(stateKey(key), JSON.stringify(value));
      },
      get: async (key: string) => {
        const raw = await AsyncStorage.getItem(stateKey(key));
        return raw ? (JSON.parse(raw) as NodeSavedState) : undefined;
      },
      del: async (key: string) => {
        await AsyncStorage.removeItem(stateKey(key));
      },
    },
    sessionStore: {
      set: async (sub: string, value: NodeSavedSession) => {
        await AsyncStorage.setItem(sessionKey(sub), JSON.stringify(value));
      },
      get: async (sub: string) => {
        const raw = await AsyncStorage.getItem(sessionKey(sub));
        return raw ? (JSON.parse(raw) as NodeSavedSession) : undefined;
      },
      del: async (sub: string) => {
        await AsyncStorage.removeItem(sessionKey(sub));
      },
    },
  };

  const clientMetadata = await NodeOAuthClient.fetchMetadata(options);
  return new NodeOAuthClient({
    ...options,
    clientMetadata,
    responseMode: "query",
  });
}

function stateKey(key: string): string {
  return `${STATE_PREFIX}${key}`;
}

function sessionKey(sub: string): string {
  return `${SESSION_PREFIX}${sub}`;
}

export async function authenticateBlueskyAccount(handleInput: string) {
  const sanitizedHandle = normalizeHandle(handleInput);
  if (!sanitizedHandle) {
    throw new Error("Enter your Bluesky handle");
  }

  const client = await getClient();
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "cydmobile",
    path: "oauth/bluesky",
    preferLocalhost: false,
  }) as OAuthRedirectUri;

  const authUrl = await client.authorize(sanitizedHandle, {
    redirect_uri: redirectUri,
  });

  const result = await WebBrowser.openAuthSessionAsync(
    authUrl.toString(),
    redirectUri,
  );

  if (result.type !== "success") {
    if (
      result.type === WebBrowser.WebBrowserResultType.CANCEL ||
      result.type === WebBrowser.WebBrowserResultType.DISMISS
    ) {
      throw new Error("Authentication canceled");
    }
    throw new Error("Authentication failed. Please try again.");
  }

  const params = new URL(result.url).searchParams;

  const { session } = await client.callback(params, {
    redirect_uri: redirectUri,
  });

  const agent = new Agent(session);
  const profileResponse = await agent.getProfile({ actor: session.did });

  return saveAuthenticatedBlueskyAccount({
    session,
    profile: profileResponse.data,
  });
}
