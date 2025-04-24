import fs from 'fs'
import Database from 'better-sqlite3'

import { FacebookPostRow } from './types';
import { writeJSONArray, removeItems } from '../util';
import { exec } from '../database'

import { FacebookArchive, Post } from "../../archive-static-sites/facebook-archive/src/types";

export interface PostRow extends FacebookPostRow {
    media: string;
    urls: string;
}

export const selectPosts = (db: Database.Database): Post[] => {
    const sql = `
        SELECT 
            post.postID AS postID,
            post.createdAt AS createdAt,
            post.text AS text,
            post.title AS title,
            post.isReposted AS isReposted,
            post.archivedAt AS archivedAt,
            json_group_array(json_object(
                'mediaId', post_media.mediaId,
                'type', post_media.type,
                'uri', post_media.uri,
                'description', post_media.description,
                'createdAt', post_media.createdAt
            )) AS media,
            json_group_array(post_url.url) AS urls
        FROM post
        LEFT JOIN post_media ON post.postID = post_media.postId
        LEFT JOIN post_url ON post.postID = post_url.postId
        GROUP BY post.postID
        ORDER BY post.createdAt DESC;
    `;
    const rows: PostRow[] = exec(db, sql, [], "all") as PostRow[];

    // Populate the posts array
    const posts: Post[] = [];
    rows.forEach((row) => {
        const post: Post = {
            postID: row['postID'],
            createdAt: row['createdAt'],
            text: row['text'] || '',
            title: row['title'] || '',
            isReposted: !!row['isReposted'],
            archivedAt: row['archivedAt'] || null,
            media: row['media'] ? JSON.parse(row['media']) : undefined,
            urls: row['urls'] ? JSON.parse(row['urls']) : undefined,
        };

        // Because of how SQLite handles JSON, we need to check if the media and urls are null
        // and set them to empty arrays if they are

        if (!post.media) {
            post.media = [];
        } else {
            post.media = removeItems(post.media, {
                mediaId: null,
                type: null,
                uri: null,
                description: null,
                createdAt: null,
            });
        }
        if (!post.urls) {
            post.urls = [];
        } else {
            post.urls = removeItems(post.urls, null);
        }

        posts.push(post);
    });

    return posts;
};

export const saveArchive = (db: Database.Database, appVersion: string, username: string, filename: string) => {
    // Build the XArchive object
    const facebookArchive: FacebookArchive = {
        appVersion,
        username,
        createdAt: new Date().toISOString(),
        posts: selectPosts(db),
    };

    // Save it to disk using streaming
    const streamWriter = fs.createWriteStream(filename);
    try {
        // Write the window.archiveData prefix
        streamWriter.write('window.archiveData=');

        // Write the archive metadata
        streamWriter.write('{\n');
        streamWriter.write(`  "appVersion": ${JSON.stringify(facebookArchive.appVersion)},\n`);
        streamWriter.write(`  "username": ${JSON.stringify(facebookArchive.username)},\n`);
        streamWriter.write(`  "createdAt": ${JSON.stringify(facebookArchive.createdAt)},\n`);

        // Write each array separately using a streaming approach in case the arrays are large
        writeJSONArray(streamWriter, facebookArchive.posts, "posts");
        streamWriter.write(',\n');

        // Close the object
        streamWriter.write('};');

        streamWriter.end();
    } catch (error) {
        streamWriter.end();
        throw error;
    }
}
