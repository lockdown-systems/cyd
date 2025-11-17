import { randomUUID } from "crypto";

import { exec } from "../../../database";
import { getTimestampDaysAgo } from "../../../util";
import type { XAccountController } from "../../x_account_controller";

export type TweetSeed = {
  tweetID?: string;
  username?: string;
  text?: string;
  createdAt?: string;
  likeCount?: number;
  retweetCount?: number;
  quoteCount?: number;
  replyCount?: number;
  isLiked?: number;
  isRetweeted?: number;
  isBookmarked?: number;
  conversationID?: string;
  path?: string;
  addedToDatabaseAt?: string;
  archivedAt?: string | null;
  deletedTweetAt?: string | null;
  deletedRetweetAt?: string | null;
  deletedLikeAt?: string | null;
  deletedBookmarkAt?: string | null;
  hasMedia?: number;
  isReply?: number;
  replyTweetID?: string | null;
  replyUserID?: string | null;
  isQuote?: number;
  quotedTweet?: string | null;
};

export type ConversationSeed = {
  conversationID: string;
  type?: string;
  addedToDatabaseAt?: string;
  deletedAt?: string | null;
};

export type MessageSeed = {
  messageID: string;
  conversationID: string;
  createdAt?: string;
  senderID?: string;
  text?: string;
  deletedAt?: string | null;
};

function requireAccount(controller: XAccountController) {
  if (!controller.account) {
    throw new Error("Controller account is not initialized");
  }
}

function ensureDB(controller: XAccountController) {
  if (!controller.db) {
    controller.initDB();
  }
  if (!controller.db) {
    throw new Error("Controller database is not initialized");
  }
}

export function seedTweet(
  controller: XAccountController,
  overrides: TweetSeed = {},
): string {
  requireAccount(controller);
  ensureDB(controller);

  const tweetID = overrides.tweetID ?? randomUUID();
  const now = new Date().toISOString();
  const data = {
    tweetID,
    username: controller.account!.username,
    text: "Test tweet",
    createdAt: getTimestampDaysAgo(0),
    likeCount: 0,
    retweetCount: 0,
    quoteCount: 0,
    replyCount: 0,
    isLiked: 0,
    isRetweeted: 0,
    isBookmarked: 0,
    conversationID: randomUUID(),
    path: `${controller.account!.username}/status/${tweetID}`,
    addedToDatabaseAt: now,
    archivedAt: null,
    deletedTweetAt: null,
    deletedRetweetAt: null,
    deletedLikeAt: null,
    deletedBookmarkAt: null,
    hasMedia: 0,
    isReply: 0,
    replyTweetID: null,
    replyUserID: null,
    isQuote: 0,
    quotedTweet: null,
    ...overrides,
  };

  exec(
    controller.db!,
    `INSERT INTO tweet (
        tweetID,
        username,
        text,
        createdAt,
        likeCount,
        retweetCount,
        quoteCount,
        replyCount,
        isLiked,
        isRetweeted,
        isBookmarked,
        conversationID,
        path,
        addedToDatabaseAt,
        archivedAt,
        deletedTweetAt,
        deletedRetweetAt,
        deletedLikeAt,
        deletedBookmarkAt,
        hasMedia,
        isReply,
        replyTweetID,
        replyUserID,
        isQuote,
        quotedTweet
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tweetID,
      data.username,
      data.text,
      data.createdAt,
      data.likeCount,
      data.retweetCount,
      data.quoteCount,
      data.replyCount,
      data.isLiked,
      data.isRetweeted,
      data.isBookmarked,
      data.conversationID,
      data.path,
      data.addedToDatabaseAt,
      data.archivedAt,
      data.deletedTweetAt,
      data.deletedRetweetAt,
      data.deletedLikeAt,
      data.deletedBookmarkAt,
      data.hasMedia,
      data.isReply,
      data.replyTweetID,
      data.replyUserID,
      data.isQuote,
      data.quotedTweet,
    ],
  );

  return data.tweetID;
}

export function seedConversation(
  controller: XAccountController,
  seed: ConversationSeed,
): void {
  ensureDB(controller);

  const now = new Date().toISOString();
  const data = {
    type: "DM",
    addedToDatabaseAt: now,
    deletedAt: null,
    ...seed,
  };

  exec(
    controller.db!,
    `INSERT INTO conversation (
        conversationID,
        type,
        sortTimestamp,
        minEntryID,
        maxEntryID,
        isTrusted,
        shouldIndexMessages,
        addedToDatabaseAt,
        updatedInDatabaseAt,
        deletedAt
    ) VALUES (?, ?, NULL, NULL, NULL, 0, 0, ?, ?, ?)`,
    [
      data.conversationID,
      data.type,
      data.addedToDatabaseAt,
      data.addedToDatabaseAt,
      data.deletedAt,
    ],
  );
}

export function seedMessage(
  controller: XAccountController,
  seed: MessageSeed,
): void {
  ensureDB(controller);

  const data = {
    createdAt: new Date().toISOString(),
    senderID: "sender",
    text: "Hello",
    deletedAt: null,
    ...seed,
  };

  exec(
    controller.db!,
    `INSERT INTO message (
        messageID,
        conversationID,
        createdAt,
        senderID,
        text,
        deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.messageID,
      data.conversationID,
      data.createdAt,
      data.senderID,
      data.text,
      data.deletedAt,
    ],
  );
}
