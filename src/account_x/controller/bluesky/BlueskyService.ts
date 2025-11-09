import path from "path";
import fs from "fs";
import mime from "mime-types";

import { shell } from "electron";
import log from "electron-log/main";
import Database from "better-sqlite3";

import {
  NodeOAuthClient,
  NodeSavedState,
  NodeSavedSession,
  OAuthSession,
  NodeOAuthClientFromMetadataOptions,
} from "@atproto/oauth-client-node";
import { Agent, BlobRef, RichText } from "@atproto/api";
import { Record as BskyPostRecord } from "@atproto/api/dist/client/types/app/bsky/feed/post";

import { getImageDimensions } from "../../../shared/utils/image-utils";
import {
  XAccount,
  XMigrateTweetCounts,
  BlueskyMigrationProfile,
  BlueskyAPIError,
  isBlueskyAPIError,
  XRateLimitInfo,
  XTweetItem,
} from "../../../shared_types";
import {
  exec,
  Sqlite3Count,
  setConfig as globalSetConfig,
  deleteConfig as globalDeleteConfig,
} from "../../../database";
import {
  XTweetRow,
  XTweetMediaRow,
  XTweetURLRow,
  XTweetBlueskyMigrationRow,
} from "../../types";

/**
 * Service class for handling Bluesky migration operations for X/Twitter accounts.
 * This encapsulates all Bluesky-related functionality that was previously in XAccountController.
 */
export class BlueskyService {
  private blueskyClient: NodeOAuthClient | null = null;

  constructor(
    private db: Database.Database,
    private account: XAccount,
    private accountID: number,
    private getConfig: (key: string) => Promise<string | null>,
    private setConfig: (key: string, value: string) => Promise<void>,
    private deleteConfig: (key: string) => Promise<void>,
    private deleteConfigLike: (key: string) => Promise<void>,
    private fetchTweetsWithMediaAndURLs: (
      whereClause: string,
      params: (string | number)[],
    ) => XTweetItem[],
    private getMediaPath: () => Promise<string>,
    private updateRateLimitInfo: (info: Partial<XRateLimitInfo>) => void,
  ) {}

  private async clientFromClientID(
    host: string,
    path: string,
  ): Promise<NodeOAuthClient> {
    const options: NodeOAuthClientFromMetadataOptions = {
      clientId: `https://${host}/${path}`,
      stateStore: {
        set: async (
          key: string,
          internalState: NodeSavedState,
        ): Promise<void> => {
          await this.setConfig(
            `blueskyStateStore-${key}`,
            JSON.stringify(internalState),
          );
        },
        get: async (key: string): Promise<NodeSavedState | undefined> => {
          const stateStore = await this.getConfig(`blueskyStateStore-${key}`);
          return stateStore ? JSON.parse(stateStore) : undefined;
        },
        del: async (key: string): Promise<void> => {
          await this.setConfig(`blueskyStateStore-${key}`, "");
        },
      },
      sessionStore: {
        set: async (sub: string, session: NodeSavedSession): Promise<void> => {
          await this.setConfig(
            `blueskySessionStore-${sub}`,
            JSON.stringify(session),
          );
        },
        get: async (sub: string): Promise<NodeSavedSession | undefined> => {
          const sessionStore = await this.getConfig(
            `blueskySessionStore-${sub}`,
          );
          return sessionStore ? JSON.parse(sessionStore) : undefined;
        },
        del: async (sub: string): Promise<void> => {
          await this.setConfig(`blueskySessionStore-${sub}`, "");
        },
      },
    };
    const clientMetadata = await NodeOAuthClient.fetchMetadata(options);
    return new NodeOAuthClient({ ...options, clientMetadata });
  }

  async initClient(): Promise<NodeOAuthClient> {
    // Figure out the host and path
    let host;
    if (process.env.CYD_MODE === "prod") {
      host = "api.cyd.social";
    } else {
      host = "dev-api.cyd.social";
    }
    const path = "bluesky/client-metadata.json";

    // Create the client
    try {
      // Try creating a client
      return await this.clientFromClientID(host, path);
    } catch (e) {
      log.error("BlueskyService.initClient: Error creating Bluesky client", e);
      // On error, disconnect and delete old state and session data
      await this.disconnect();

      // And try again
      return await this.clientFromClientID(host, path);
    }
  }

  async getProfile(): Promise<BlueskyMigrationProfile | null> {
    if (!this.blueskyClient) {
      this.blueskyClient = await this.initClient();
    }

    const did = await this.getConfig("blueskyDID");
    if (!did) {
      return null;
    }

    let session: OAuthSession;
    try {
      session = await this.blueskyClient.restore(did);
    } catch (e) {
      log.warn("BlueskyService.getProfile: Failed to restore session", e);
      return null;
    }
    const agent = new Agent(session);
    if (!agent.did) {
      return null;
    }

    const profile = await agent.getProfile({ actor: agent.did });
    const blueskyMigrationProfile: BlueskyMigrationProfile = {
      did: profile.data.did,
      handle: profile.data.handle,
      displayName: profile.data.displayName,
      avatar: profile.data.avatar,
    };
    return blueskyMigrationProfile;
  }

  async authorize(handle: string): Promise<boolean | string> {
    // Initialize the Bluesky client
    if (!this.blueskyClient) {
      this.blueskyClient = await this.initClient();
    }

    try {
      // Check if the handle starts with @. If so, strip the @ and try authorizing
      if (handle.startsWith("@")) {
        handle = handle.substring(1);
      }

      // Authorize the handle
      const url = await this.blueskyClient.authorize(handle);

      // Save the account ID in the global config
      await globalSetConfig("blueskyOAuthAccountID", this.accountID.toString());

      // Open the URL in the default browser
      await shell.openExternal(url.toString());

      return true;
    } catch (e: unknown) {
      if (e instanceof Error) {
        log.error(
          "BlueskyService.authorize: Error authorizing Bluesky client",
          e,
        );
        return e.message;
      } else {
        log.error("BlueskyService.authorize: Unknown error", e);
        return String(e);
      }
    }
  }

  async callback(queryString: string): Promise<boolean | string> {
    // Initialize the Bluesky client
    if (!this.blueskyClient) {
      this.blueskyClient = await this.initClient();
    }

    const params = new URLSearchParams(queryString);

    // Handle errors
    const error = params.get("error");
    const errorDescription = params.get("error_description");
    if (errorDescription) {
      return errorDescription;
    }
    if (error) {
      return `The authorization failed with error: ${error}`;
    }

    // Finish the callback
    const { session, state } = await this.blueskyClient.callback(params);

    log.info(
      "BlueskyService.callback: authorize() was called with state",
      state,
    );
    log.info("BlueskyService.callback: user authenticated as", session.did);

    // Save the did
    await this.setConfig("blueskyDID", session.did);

    const agent = new Agent(session);
    if (agent.did) {
      // Make Authenticated API calls
      const profile = await agent.getProfile({ actor: agent.did });
      log.info("Bluesky profile:", profile.data);

      return true;
    } else {
      return "agent.did is null";
    }
  }

  async disconnect(): Promise<void> {
    // Revoke the session
    try {
      if (!this.blueskyClient) {
        this.blueskyClient = await this.initClient();
      }
      const did = await this.getConfig("blueskyDID");
      if (did) {
        const session = await this.blueskyClient.restore(did);
        await session.signOut();
      }
    } catch (e) {
      log.error("BlueskyService.disconnect: Error revoking session", e);
    }

    // Delete from global config
    await globalDeleteConfig("blueskyOAuthAccountID");

    // Delete from account config
    await this.deleteConfig("blueskyDID");
    await this.deleteConfigLike("blueskyStateStore-%");
    await this.deleteConfigLike("blueskySessionStore-%");
  }

  async getTweetCounts(): Promise<XMigrateTweetCounts> {
    const username = this.account.username;
    const userID = this.account.userID;

    // Total tweets count
    const totalTweets: Sqlite3Count = exec(
      this.db,
      `
            SELECT COUNT(*) AS count
            FROM tweet
            WHERE tweet.isLiked = ?
            AND tweet.username = ?
            AND tweet.deletedTweetAt IS NULL
        `,
      [0, username],
      "get",
    ) as Sqlite3Count;

    // Total retweets count
    const totalRetweets: Sqlite3Count = exec(
      this.db,
      `
            SELECT COUNT(*) AS count
            FROM tweet
            WHERE tweet.text LIKE ?
            AND tweet.isLiked = ?
            AND tweet.username = ?
            AND tweet.deletedTweetAt IS NULL
        `,
      ["RT @%", 0, username],
      "get",
    ) as Sqlite3Count;

    // Tweets to migrate (including deleted tweets)
    const toMigrateTweets = this.fetchTweetsWithMediaAndURLs(
      `
            t.text NOT LIKE ?
            AND t.isLiked = ?
            AND t.username = ?
            AND t.tweetID NOT IN (SELECT tweetID FROM tweet_bsky_migration)
            AND (t.isReply = ? OR (t.isReply = ? AND t.replyUserID = ?))
        `,
      ["RT @%", 0, username, 0, 1, userID],
    );

    // Tweets that cannot be migrated
    const cannotMigrate: Sqlite3Count = exec(
      this.db,
      `
            SELECT COUNT(*) AS count
            FROM tweet
            LEFT JOIN tweet_bsky_migration ON tweet.tweetID = tweet_bsky_migration.tweetID
            WHERE tweet_bsky_migration.tweetID IS NULL
            AND tweet.text NOT LIKE ?
            AND tweet.isLiked = ?
            AND tweet.username = ?
            AND (tweet.isReply = ? AND tweet.replyUserID != ?)
        `,
      ["RT @%", 0, username, 1, userID],
      "get",
    ) as Sqlite3Count;

    // Already migrated tweets (including deleted ones)
    const alreadyMigratedTweets = this.fetchTweetsWithMediaAndURLs(
      `
            t.text NOT LIKE ?
            AND t.isLiked = ?
            AND t.username = ?
            AND t.tweetID IN (SELECT tweetID FROM tweet_bsky_migration)
        `,
      ["RT @%", 0, username],
    );

    // Return the counts
    const resp: XMigrateTweetCounts = {
      totalTweetsCount: totalTweets.count,
      totalRetweetsCount: totalRetweets.count,
      toMigrateTweets,
      cannotMigrateCount: cannotMigrate.count,
      alreadyMigratedTweets,
    };

    log.info("BlueskyService.getTweetCounts: returning", resp);
    return resp;
  }

  async migrateTweetBuildRecord(
    agent: Agent,
    tweetID: string,
  ): Promise<[BskyPostRecord, string] | string> {
    // In case the tweet needs to be split into multiple posts, this is the text of the second post
    let nextPostText = "";

    // Select the tweet
    let tweet: XTweetRow;
    try {
      tweet = exec(
        this.db,
        `
                SELECT *
                FROM tweet
                WHERE tweetID = ?
            `,
        [tweetID],
        "get",
      ) as XTweetRow;
    } catch (e) {
      return `Error selecting tweet: ${e}`;
    }

    // Start building the tweet text and facets
    let text = tweet.text;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const facets: any[] = [];

    // Replace t.co links with actual links
    let tweetURLs: XTweetURLRow[];
    try {
      tweetURLs = exec(
        this.db,
        `
                SELECT *
                FROM tweet_url
                WHERE tweetID = ?
            `,
        [tweetID],
        "all",
      ) as XTweetURLRow[];
    } catch (e) {
      return `Error selecting tweet URLs: ${e}`;
    }
    for (const tweetURL of tweetURLs) {
      text = text.replace(tweetURL.url, tweetURL.expandedURL);
    }

    // Handle replies
    const userID = this.account?.userID;
    let reply = null;
    if (tweet.isReply && tweet.replyUserID == userID) {
      // Find the parent tweet migration
      let parentMigration: XTweetBlueskyMigrationRow;
      try {
        parentMigration = exec(
          this.db,
          `
                    SELECT *
                    FROM tweet_bsky_migration
                    WHERE tweetID = ?
                `,
          [tweet.replyTweetID],
          "get",
        ) as XTweetBlueskyMigrationRow;
      } catch (e) {
        return `Error selecting parent migration: ${e}`;
      }
      if (parentMigration) {
        // Find the root tweet in the thread
        let foundRoot = false;
        let rootTweetID = tweet.replyTweetID;
        while (!foundRoot) {
          let parentTweet: XTweetRow;
          try {
            parentTweet = exec(
              this.db,
              `
                            SELECT *
                            FROM tweet
                            WHERE tweetID = ?
                        `,
              [rootTweetID],
              "get",
            ) as XTweetRow;
          } catch (e) {
            return `Error selecting parent tweet: ${e}`;
          }
          if (
            parentTweet &&
            parentTweet.isReply &&
            parentTweet.replyUserID == userID
          ) {
            rootTweetID = parentTweet.replyTweetID;
          } else {
            foundRoot = true;
          }
        }

        if (foundRoot) {
          // Get the root migration
          let rootMigration: XTweetBlueskyMigrationRow;
          try {
            rootMigration = exec(
              this.db,
              `
                            SELECT *
                            FROM tweet_bsky_migration
                            WHERE tweetID = ?
                        `,
              [rootTweetID],
              "get",
            ) as XTweetBlueskyMigrationRow;
          } catch (e) {
            return `Error selecting root migration: ${e}`;
          }
          if (rootMigration) {
            // Build the reply
            reply = {
              root: {
                uri: rootMigration.atprotoURI,
                cid: rootMigration.atprotoCID,
              },
              parent: {
                uri: parentMigration.atprotoURI,
                cid: parentMigration.atprotoCID,
              },
            };
          }
        }
      }
    }

    // Handle quotes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let embed: any = null;
    if (tweet.isQuote && tweet.quotedTweet) {
      // Parse the quoted tweet URL to see if it's a self-quote
      // URL looks like: https://twitter.com/{username}/status/{tweetID}
      const quotedTweetURL = new URL(tweet.quotedTweet);
      const quotedTweetUsername = quotedTweetURL.pathname.split("/")[1];
      const quotedTweetID = quotedTweetURL.pathname.split("/")[3];

      // Self quote
      if (quotedTweetUsername == this.account?.username) {
        // Load the quoted tweet migration
        let quotedMigration: XTweetBlueskyMigrationRow;
        try {
          quotedMigration = exec(
            this.db,
            `
                        SELECT *
                        FROM tweet_bsky_migration
                        WHERE tweetID = ?
                    `,
            [quotedTweetID],
            "get",
          ) as XTweetBlueskyMigrationRow;
        } catch (e) {
          return `Error selecting quoted migration: ${e}`;
        }
        if (quotedMigration) {
          embed = {
            $type: "app.bsky.embed.record",
            record: {
              uri: quotedMigration.atprotoURI,
              cid: quotedMigration.atprotoCID,
            },
          };
        }
      }

      // External quote? Make it a website card
      if (!embed) {
        embed = {
          $type: "app.bsky.embed.external",
          external: {
            uri: tweet.quotedTweet,
            title: "Quoted Tweet on X",
            description: `View tweet at ` + quotedTweetURL,
          },
        };
      }
    }

    // Handle media
    let tweetMedia: XTweetMediaRow[];
    try {
      tweetMedia = exec(
        this.db,
        `
                SELECT *
                FROM tweet_media
                WHERE tweetID = ?
            `,
        [tweetID],
        "all",
      ) as XTweetMediaRow[];
    } catch (e) {
      return `Error selecting tweet media: ${e}`;
    }

    // Check if we have any video or animated_gif media
    const videoMedia = tweetMedia.find(
      (media) =>
        media.mediaType === "video" || media.mediaType === "animated_gif",
    );

    if (videoMedia) {
      // Video media (Bluesky only supports one video per post, so use the first one)
      const allVideoMedia = tweetMedia.filter(
        (media) =>
          media.mediaType === "video" || media.mediaType === "animated_gif",
      );
      if (allVideoMedia.length > 1) {
        log.warn(
          `BlueskyService.migrateTweetBuildRecord: Tweet has ${allVideoMedia.length} videos/animated GIFs, but Bluesky only supports 1. Using the first one: ${videoMedia.filename}`,
        );
      }

      // max size for videos: https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/embed/video.json
      const maxSize = 50000000;

      // Load the video (use first video/animated_gif found)
      const outputPath = await this.getMediaPath();
      const mediaPath = path.join(outputPath, videoMedia.filename);
      let mediaData;
      try {
        mediaData = fs.readFileSync(mediaPath);
      } catch (e) {
        return `Error reading media file: ${e}`;
      }

      let shouldContinue = true;

      // Make sure it's not too big
      if (mediaData.length > maxSize) {
        log.warn(
          `BlueskyService.migrateTweetBuildRecord: media file too large: ${videoMedia.filename}`,
        );
        shouldContinue = false;
      }

      if (shouldContinue) {
        // Determine the MIME type
        let mimeType = mime.lookup(mediaPath);
        if (mimeType == "application/mp4") {
          mimeType = "video/mp4";
        }
        if (!mimeType) {
          log.warn(
            `BlueskyService.migrateTweetBuildRecord: could not determine MIME type for media file: ${videoMedia.filename}`,
          );
          shouldContinue = false;
        }
        if (mimeType != "video/mp4") {
          log.warn(
            `BlueskyService.migrateTweetBuildRecord: video file is not mp4: ${videoMedia.filename} (mime type is ${mimeType})`,
          );
          shouldContinue = false;
        }
      }

      if (shouldContinue) {
        // Upload the video
        log.info(
          `BlueskyService.migrateTweetBuildRecord: uploading video ${videoMedia.filename}`,
        );
        const resp = await agent.uploadBlob(mediaData, {
          encoding: "video/mp4",
        });
        log.info(
          `BlueskyService.migrateTweetBuildRecord: uploaded video ${videoMedia.filename} response`,
          resp,
        );
        const videoBlob: BlobRef = resp.data.blob;

        // Remove the link from the tweet text
        text = text.replace(videoMedia.url, "");
        text = text.trim();

        // If there's already an embedded record, turn it into a recordWithMedia embed
        if (embed && embed["$type"] == "app.bsky.embed.record") {
          embed = {
            $type: "app.bsky.embed.recordWithMedia",
            record: embed,
            media: {
              $type: "app.bsky.embed.video",
              video: videoBlob,
            },
          };
        } else {
          // If there's an embedded external link, turn it into a facet
          if (
            embed &&
            embed["$type"] == "app.bsky.embed.external" &&
            embed.external?.uri
          ) {
            text += ` ${embed.external.uri}`;
            facets.push({
              index: {
                byteStart: text.length - embed.external.uri.length,
                byteEnd: text.length,
              },
              features: [
                {
                  $type: "app.bsky.richtext.facet#link",
                  uri: embed.external.uri,
                },
              ],
            });
          }

          // Embed the video
          embed = {
            $type: "app.bsky.embed.video",
            video: videoBlob,
          };
        }
      }
    }

    // Handle remaining non-video media as images
    const imageMedia = tweetMedia.filter(
      (media) =>
        media.mediaType !== "video" && media.mediaType !== "animated_gif",
    );

    if (imageMedia.length > 0) {
      // Images media
      // max size for images: https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/embed/images.json
      const maxSize = 1000000;

      // Keep track of images for the embed
      const images: {
        alt: string;
        image: BlobRef;
        aspectRatio?: {
          width: number;
          height: number;
        };
      }[] = [];

      for (const media of imageMedia) {
        // Load the image
        const outputPath = await this.getMediaPath();
        const mediaPath = path.join(outputPath, media.filename);
        let mediaData;
        try {
          mediaData = fs.readFileSync(mediaPath);
        } catch (e) {
          return `Error reading media file: ${e}`;
        }

        // Make sure it's not too big
        if (mediaData.length > maxSize) {
          log.warn(
            `BlueskyService.migrateTweetBuildRecord: media file too large: ${media.filename}`,
          );
          continue;
        }

        // Determine the MIME type
        const mimeType = mime.lookup(mediaPath);
        if (!mimeType) {
          log.warn(
            `BlueskyService.migrateTweetBuildRecord: could not determine MIME type for media file: ${media.filename}`,
          );
          continue;
        }

        // Determine the aspect ratio
        const dimensions = await getImageDimensions(mediaPath);

        // Upload the image
        log.info(
          `BlueskyService.migrateTweetBuildRecord: uploading image ${media.filename}`,
        );
        const resp = await agent.uploadBlob(mediaData, { encoding: mimeType });
        log.info(
          `BlueskyService.migrateTweetBuildRecord: uploaded image ${media.filename} response`,
          resp,
        );

        // Add it to the list
        images.push({
          alt: "",
          image: resp.data.blob,
          aspectRatio: {
            width: dimensions?.width || 1,
            height: dimensions?.height || 1,
          },
        });

        // Remove the link from the tweet text
        text = text.replace(media.url, "");
        text = text.trim();
      }

      // If there's already an embedded record, turn it into a recordWithMedia embed
      if (embed && embed["$type"] == "app.bsky.embed.record") {
        embed = {
          $type: "app.bsky.embed.recordWithMedia",
          record: embed,
          media: {
            $type: "app.bsky.embed.images",
            images: images,
          },
        };
      } else {
        // If there's an embedded external link, turn it into a facet
        if (
          embed &&
          embed["$type"] == "app.bsky.embed.external" &&
          embed.external?.uri
        ) {
          text += ` ${embed.external.uri}`;
          facets.push({
            index: {
              byteStart: text.length - embed.external.uri.length,
              byteEnd: text.length,
            },
            features: [
              {
                $type: "app.bsky.richtext.facet#link",
                uri: embed.external.uri,
              },
            ],
          });
        }

        // Embed the images
        embed = {
          $type: "app.bsky.embed.images",
          images: images,
        };
      }
    }

    // Start a richtext object
    let rt = new RichText({
      text: text,
      facets: facets,
    });
    await rt.detectFacets(agent);

    // Is it too long?
    if (rt.graphemeLength > 300) {
      // If it's too long, fall back to t.co links because they're shortened
      text = tweet.text;
      for (const tweetURL of tweetURLs) {
        text = text.replace(tweetURL.expandedURL, tweetURL.url);
      }

      // Update the richtext object
      rt = new RichText({
        text: text,
        facets: facets,
      });
      await rt.detectFacets(agent);
    }

    // Is it STILL too long?
    if (rt.graphemeLength > 300) {
      // Make the links longer again because why not
      text = tweet.text;
      for (const tweetURL of tweetURLs) {
        text = text.replace(tweetURL.url, tweetURL.expandedURL);
      }

      // Split the text into words
      const words = text.split(" ");

      // Initialize the new text and nextText
      let newText = "";
      const continuationText = " (...)";

      // Iterate through the words to build the new text
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if ((newText + " " + word + continuationText).length <= 300) {
          newText += (newText ? " " : "") + word;
        } else {
          nextPostText = words.slice(i).join(" ");
          break;
        }
      }

      // Append the continuation text
      newText += continuationText;

      // Update the text and nextText variables
      text = newText;
      rt = new RichText({
        text: text,
        facets: facets,
      });
      await rt.detectFacets(agent);
    }

    // Build the record
    const record: BskyPostRecord = {
      $type: "app.bsky.feed.post",
      text: rt.text,
      facets: rt.facets,
      createdAt: tweet.createdAt,
    };
    if (reply) {
      record["reply"] = reply;
    }
    if (embed) {
      record["embed"] = embed;
    }
    return [record, nextPostText];
  }

  private handleAPIError(e: unknown, method: string, message: string): string {
    if (isBlueskyAPIError(e)) {
      const error = e as BlueskyAPIError;
      if (error.error == "RateLimitExceeded") {
        log.error(
          `BlueskyService.${method}: Rate limit exceeded`,
          JSON.stringify(e),
        );
        this.updateRateLimitInfo({
          isRateLimited: true,
          rateLimitReset: Number(error.headers["ratelimit-reset"]),
        });
        return `RateLimitExceeded`;
      } else {
        log.error(`BlueskyService.${method}: Bluesky error`, JSON.stringify(e));
        return `${message}: ${e}`;
      }
    }

    log.error(`BlueskyService.${method}: ${message}`, e);
    return `${message}: ${e}`;
  }

  // Return true on success, and a string (error message) on error
  async migrateTweet(tweetID: string): Promise<boolean | string> {
    // Get the Bluesky client
    if (!this.blueskyClient) {
      this.blueskyClient = await this.initClient();
    }
    const did = await this.getConfig("blueskyDID");
    if (!did) {
      return "Bluesky DID not found";
    }
    const session = await this.blueskyClient.restore(did);
    const agent: Agent = new Agent(session);

    // Build the record
    let resp: [BskyPostRecord, string] | string;
    try {
      resp = await this.migrateTweetBuildRecord(agent, tweetID);
    } catch (e) {
      return this.handleAPIError(
        e,
        "migrateTweetBuildRecord",
        `Error building atproto record`,
      );
    }
    if (typeof resp === "string") {
      return resp;
    }
    const [record, nextPostText] = resp;

    try {
      // Post it to Bluesky
      const { uri, cid } = await agent.post(record);

      // Do we need to post a continuation?
      if (nextPostText != "") {
        let rootURI;
        let rootCID;
        if (record.reply) {
          rootURI = record.reply.root.uri;
          rootCID = record.reply.root.cid;
        } else {
          rootURI = uri;
          rootCID = cid;
        }

        // Build the rich text
        const rt = new RichText({
          text: nextPostText,
        });
        await rt.detectFacets(agent);

        // Build the record
        const continuationRecord: BskyPostRecord = {
          $type: "app.bsky.feed.post",
          text: rt.text,
          facets: rt.facets,
          createdAt: record.createdAt,
          reply: {
            root: {
              uri: rootURI,
              cid: rootCID,
            },
            parent: {
              uri: uri,
              cid: cid,
            },
          },
        };

        // Post it to Bluesky
        try {
          const { uri: continuationURI, cid: continuationCID } =
            await agent.post(continuationRecord);

          // Record that we migrated this tweet
          try {
            exec(
              this.db,
              `
                        INSERT INTO tweet_bsky_migration (tweetID, atprotoURI, atprotoCID, migratedAt)
                        VALUES (?, ?, ?, ?)
                    `,
              [tweetID, continuationURI, continuationCID, new Date()],
            );
          } catch (e) {
            return `Error recording migration: ${e}`;
          }
        } catch (e) {
          return this.handleAPIError(
            e,
            "migrateTweet",
            `Error migrating continuation tweet to Bluesky`,
          );
        }
      }

      // Record that we migrated this tweet
      try {
        exec(
          this.db,
          `
                    INSERT INTO tweet_bsky_migration (tweetID, atprotoURI, atprotoCID, migratedAt)
                    VALUES (?, ?, ?, ?)
                `,
          [tweetID, uri, cid, new Date()],
        );
      } catch (e) {
        return `Error recording migration: ${e}`;
      }

      return true;
    } catch (e) {
      return this.handleAPIError(
        e,
        "migrateTweet",
        `Error migrating tweet to Bluesky`,
      );
    }
  }

  async deleteMigratedTweet(tweetID: string): Promise<boolean | string> {
    // Get the Bluesky client
    if (!this.blueskyClient) {
      this.blueskyClient = await this.initClient();
    }
    const did = await this.getConfig("blueskyDID");
    if (!did) {
      return "Bluesky DID not found";
    }
    const session = await this.blueskyClient.restore(did);
    const agent = new Agent(session);

    // Select the migration record
    const migration: XTweetBlueskyMigrationRow = exec(
      this.db,
      `
            SELECT *
            FROM tweet_bsky_migration
            WHERE tweetID = ?
        `,
      [tweetID],
      "get",
    ) as XTweetBlueskyMigrationRow;

    try {
      // Delete it from Bluesky
      await agent.deletePost(migration.atprotoURI);

      try {
        // Delete the migration record
        exec(
          this.db,
          `
                    DELETE FROM tweet_bsky_migration WHERE tweetID = ?
                `,
          [tweetID],
        );
      } catch (e) {
        return `Error deleting migration record: ${e}`;
      }

      return true;
    } catch (e) {
      return this.handleAPIError(
        e,
        "deleteMigratedTweet",
        `Error deleting from Bluesky`,
      );
    }
  }
}
