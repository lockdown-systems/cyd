import Database from "better-sqlite3";
import { exec } from "../../database";
import { XTweetItem } from "../../shared_types";

/**
 * Fetch tweets with their associated media and URLs from the database.
 * Groups media and URLs by tweet ID and formats the results.
 */
export function fetchTweetsWithMediaAndURLsFromDB(
    db: Database.Database,
    whereClause: string,
    params: (string | number)[],
): XTweetItem[] {
    const query = `
            SELECT
                t.tweetID, t.text, t.likeCount, t.retweetCount, t.createdAt,
                tm.mediaType, tm.filename AS mediaFilename,
                tu.expandedURL AS urlExpanded
            FROM tweet t
            LEFT JOIN tweet_media tm ON t.tweetID = tm.tweetID
            LEFT JOIN tweet_url tu ON t.tweetID = tu.tweetID
            WHERE ${whereClause}
            ORDER BY t.createdAt ASC
        `;

    const rows = exec(db, query, params, "all") as {
        tweetID: string;
        text: string;
        likeCount: number;
        retweetCount: number;
        createdAt: string;
        mediaType: string | null;
        mediaFilename: string | null;
        urlExpanded: string | null;
    }[];

    // Group the results by tweetID
    const tweetMap: Record<string, XTweetItem> = {};
    for (const row of rows) {
        if (!tweetMap[row.tweetID]) {
            tweetMap[row.tweetID] = {
                id: row.tweetID,
                t: row.text ? row.text.replace(/(?:\r\n|\r|\n)/g, "<br>").trim() : "",
                l: row.likeCount,
                r: row.retweetCount,
                d: row.createdAt,
                i: [],
                v: [],
            };
        }

        // Add media files
        if (row.mediaType === "photo") {
            tweetMap[row.tweetID].i.push(row.mediaFilename!);
        } else if (row.mediaType === "video") {
            tweetMap[row.tweetID].v.push(row.mediaFilename!);
        }

        // Replace URLs in the text
        if (row.urlExpanded) {
            tweetMap[row.tweetID].t = tweetMap[row.tweetID].t.replace(
                row.urlExpanded,
                row.urlExpanded,
            );
        }
    }

    return Object.values(tweetMap);
}
