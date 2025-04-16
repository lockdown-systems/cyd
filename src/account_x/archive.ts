import fs from 'fs'
import Database from 'better-sqlite3'

import { XTweetRow, XUserRow, XConversationRow, XMessageRow } from './types'
import { writeJSONArray, writeJSONObject } from '../util';
import { exec } from '../database'

import { XArchive, Tweet, User, Conversation, Message } from "../../archive-static-sites/x-archive/src/types";

export interface TweetRow extends XTweetRow {
    media: string;
    urls: string;
    blueskyMigrationURIs: string;
}

export interface ConversationRow extends XConversationRow {
    participants: string;
    participantSearchString: string;
}

export const selectTweets = (db: Database.Database, whereClause: string, params?: Array<number | string | bigint | Buffer | Date | null>): Tweet[] => {
    const sql = `
      SELECT 
          tweet.*,
          json_group_array(json_object(
              'mediaType', tweet_media.mediaType,
              'url', tweet_media.url,
              'filename', tweet_media.filename
          )) AS media,
          json_group_array(json_object(
              'url', tweet_url.url,
              'displayURL', tweet_url.displayURL,
              'expandedURL', tweet_url.expandedURL
          )) AS urls,
          json_group_array(tweet_bsky_migration.atprotoURI) AS blueskyMigrationURIs
      FROM tweet
      LEFT JOIN tweet_media ON tweet.tweetID = tweet_media.tweetID
      LEFT JOIN tweet_url ON tweet.tweetID = tweet_url.tweetID
      LEFT JOIN tweet_bsky_migration ON tweet.tweetID = tweet_bsky_migration.tweetID
      WHERE ${whereClause}
      GROUP BY tweet.tweetID
      ORDER BY tweet.createdAt DESC;
    `;
    const rows: TweetRow[] = exec(db, sql, params, "all") as TweetRow[];

    // Populate the tweets array
    const tweets: Tweet[] = [];
    rows.forEach((row) => {
        const tweet: Tweet = {
            tweetID: row['tweetID'],
            username: row['username'],
            createdAt: row['createdAt'],
            likeCount: row['likeCount'],
            quoteCount: row['quoteCount'],
            replyCount: row['replyCount'],
            retweetCount: row['retweetCount'],
            isLiked: !!(row['isLiked']),
            isRetweeted: !!(row['isRetweeted']),
            text: row['text'],
            path: row['path'],
            quotedTweet: row['quotedTweet'],
            archivedAt: row['archivedAt'],
            deletedTweetAt: row['deletedTweetAt'],
            deletedRetweetAt: row['deletedRetweetAt'],
            deletedLikeAt: row['deletedLikeAt'],
            deletedBookmarkAt: row['deletedBookmarkAt'],
            media: JSON.parse(row['media']),
            urls: JSON.parse(row['urls']),
            blueskyMigrationURIs: JSON.parse(row['blueskyMigrationURIs']),
        };

        // Because of how SQLite handles JSON, we need to check if the media and urls are null
        // and set them to empty arrays if they are

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        function deepEqual(obj1: any, obj2: any): boolean {
            return JSON.stringify(obj1) === JSON.stringify(obj2);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        function removeItems(arr: Array<any>, value: any) {
            let i = 0;
            while (i < arr.length) {
                if (deepEqual(arr[i], value)) {
                    arr.splice(i, 1);
                } else {
                    ++i;
                }
            }
            return arr;
        }

        tweet.media = removeItems(tweet.media, {
            mediaType: null,
            url: null,
            filename: null
        });
        tweet.urls = removeItems(tweet.urls, {
            url: null,
            displayURL: null,
            expandedURL: null
        });
        tweet.blueskyMigrationURIs = removeItems(tweet.blueskyMigrationURIs, null);

        // When importing likes from archive, occasionally text is null
        if (tweet.text === null) {
            tweet.text = '<null>';
        }

        tweets.push(tweet);
    });
    return tweets;
}

export const selectUsers = (db: Database.Database): Record<string, User> => {
    const sql = 'SELECT * FROM user';
    const rows: XUserRow[] = exec(db, sql, [], "all") as XUserRow[];
    const users: Record<string, User> = rows.reduce((acc, user) => {
        acc[user.userID] = {
            userID: user.userID,
            name: user.name ? user.name : "",
            username: user.screenName,
            profileImageDataURI: user.profileImageDataURI ? user.profileImageDataURI : "",
        };
        return acc;
    }, {} as Record<string, User>);
    return users;
}

export const selectConversations = (db: Database.Database): Conversation[] => {
    const sql = `
        SELECT 
            conversation.*,
            json_group_array(conversation_participant.userID) AS participants,
            GROUP_CONCAT(user.name || ' ' || user.screenName, ', ') AS participantSearchString
        FROM conversation
        LEFT JOIN conversation_participant ON conversation.conversationID = conversation_participant.conversationID
        LEFT JOIN user ON conversation_participant.userID = user.userID
        GROUP BY conversation.conversationID
        ORDER BY conversation.sortTimestamp DESC;
    `;
    const rows: ConversationRow[] = exec(db, sql, [], "all") as ConversationRow[];
    const conversations: Conversation[] = rows.map((row) => {
        return {
            conversationID: row['conversationID'],
            type: row['type'],
            sortTimestamp: row['sortTimestamp'],
            participants: JSON.parse(row['participants']),
            participantSearchString: row['participantSearchString'],
            deletedAt: row['deletedAt'],
        } as Conversation;
    });
    return conversations;
}

export const selectMessages = (db: Database.Database): Message[] => {
    const sql = 'SELECT * FROM message ORDER BY createdAt';
    const rows: XMessageRow[] = exec(db, sql, [], "all") as XMessageRow[];
    const messages: Message[] = rows.map((row) => {
        return {
            messageID: row['messageID'],
            conversationID: row['conversationID'],
            createdAt: row['createdAt'],
            senderID: row['senderID'],
            text: row['text'],
            deletedAt: row['deletedAt'],
        } as Message;
    });
    return messages;
}

export const saveArchive = (db: Database.Database, appVersion: string, username: string, filename: string) => {
    // Build the XArchive object
    const xArchive: XArchive = {
        appVersion,
        username,
        createdAt: new Date().toISOString(),
        tweets: selectTweets(
            db,
            'tweet.text NOT LIKE ? AND tweet.isLiked = ? AND tweet.username = ?',
            ['RT @%', 0, username]
        ),
        retweets: selectTweets(db, 'tweet.text LIKE ?', ['RT @%']),
        likes: selectTweets(db, 'tweet.isLiked = ?', [1]),
        bookmarks: selectTweets(db, 'tweet.isBookmarked = ?', [1]),
        users: selectUsers(db),
        conversations: selectConversations(db),
        messages: selectMessages(db),
    };

    // Save it to disk using streaming
    const streamWriter = fs.createWriteStream(filename);
    try {
        // Write the window.archiveData prefix
        streamWriter.write('window.archiveData=');

        // Write the archive metadata
        streamWriter.write('{\n');
        streamWriter.write(`  "appVersion": ${JSON.stringify(xArchive.appVersion)},\n`);
        streamWriter.write(`  "username": ${JSON.stringify(xArchive.username)},\n`);
        streamWriter.write(`  "createdAt": ${JSON.stringify(xArchive.createdAt)},\n`);

        // Write each array separately using a streaming approach in case the arrays are large
        writeJSONArray(streamWriter, xArchive.tweets, "tweets");
        streamWriter.write(',\n');
        writeJSONArray(streamWriter, xArchive.retweets, "retweets");
        streamWriter.write(',\n');
        writeJSONArray(streamWriter, xArchive.likes, "likes");
        streamWriter.write(',\n');
        writeJSONArray(streamWriter, xArchive.bookmarks, "bookmarks");
        streamWriter.write(',\n');
        writeJSONObject(streamWriter, xArchive.users, "users");
        streamWriter.write(',\n');
        writeJSONArray(streamWriter, xArchive.conversations, "conversations");
        streamWriter.write(',\n');
        writeJSONArray(streamWriter, xArchive.messages, "messages");

        // Close the object
        streamWriter.write('};');

        streamWriter.end();
    } catch (error) {
        streamWriter.end();
        throw error;
    }
}
