import fs from 'fs'
import Database from 'better-sqlite3'

import { writeJSONArray, removeItems, deepEqual, deepConvertNullToUndefined } from '../util';
import { exec } from '../database'

import { FacebookArchive, Story } from "../../archive-static-sites/facebook-archive/src/types";

export interface StoryRow {
    storyID: string;
    url: string;
    createdAt: string;
    text?: string;
    title?: string;
    lifeEventTitle?: string;
    user: string; // json object
    attachedStory: string; // json object
    media: string; // json array
    shares: string; // json array

    addedToDatabaseAt: string;
    archivedAt: string | null;
    deletedStoryAt: string | null;
}

export const selectStories = (db: Database.Database): Story[] => {
    const sql = `
SELECT
    story.storyID,
    story.url,
    story.createdAt,
    story.text,
    story.title,
    story.lifeEventTitle,
    json_object(
        'userID', user.userID,
        'url', user.url,
        'name', user.name,
        'profilePictureFilename', user.profilePictureFilename
    ) AS user,
    json_object(
        'storyID', attached_story.storyID,
        'text', attached_story.text,
        'media', (
            SELECT json_group_array(
                json_object(
                    'mediaType', media.mediaType,
                    'mediaID', media.mediaID,
                    'filename', media.filename,
                    'isPlayable', media.isPlayable,
                    'accessibilityCaption', media.accessibilityCaption,
                    'title', media.title,
                    'url', media.url,
                    'needsVideoDownload', media.needsVideoDownload
                )
            )
            FROM media_attached_story
            JOIN media ON media_attached_story.mediaID = media.mediaID
            WHERE media_attached_story.storyID = attached_story.storyID
        )
    ) AS attachedStory,
    json_group_array(
        json_object(
            'mediaType', media.mediaType,
            'mediaID', media.mediaID,
            'filename', media.filename,
            'isPlayable', media.isPlayable,
            'accessibilityCaption', media.accessibilityCaption,
            'title', media.title,
            'url', media.url,
            'needsVideoDownload', media.needsVideoDownload
        )
    ) AS media,
    json_group_array(
        json_object(
            'description', share.description,
            'title', share.title,
            'url', share.url,
            'media', json_object(
                'mediaType', media.mediaType,
                'mediaID', media.mediaID,
                'filename', media.filename,
                'isPlayable', media.isPlayable,
                'title', media.title,
                'url', media.url,
                'needsVideoDownload', media.needsVideoDownload
            )
        )
    ) AS shares,
    story.addedToDatabaseAt,
    story.archivedAt,
    story.deletedStoryAt
FROM story
JOIN user ON story.userID = user.userID
LEFT JOIN attached_story ON story.attachedStoryID = attached_story.storyID
LEFT JOIN media_story ON story.storyID = media_story.storyID
LEFT JOIN media ON media_story.mediaID = media.mediaID
LEFT JOIN share ON story.storyID = share.storyID
GROUP BY story.storyID
ORDER BY story.createdAt DESC;
    `;
    const rows: StoryRow[] = exec(db, sql, [], "all") as StoryRow[];

    // Populate the stories array
    const stories: Story[] = [];
    rows.forEach((row) => {
        let story: Story = {
            storyID: row.storyID,
            url: row.url,
            createdAt: row.createdAt,
            text: row.text,
            title: row.title,
            lifeEventTitle: row.lifeEventTitle,
            user: JSON.parse(row.user),
            attachedStory: JSON.parse(row.attachedStory),
            media: JSON.parse(row.media),
            shares: JSON.parse(row.shares),

            addedToDatabaseAt: row.addedToDatabaseAt,
            archivedAt: row.archivedAt,
            deletedStoryAt: row.deletedStoryAt,
        };

        // Because of how SQLite handles JSON, we need to check if the media and urls are null
        // and set them to empty arrays if they are

        if(deepEqual(story.attachedStory, {
            "storyID": null,
            "text": null,
            "media": []
          })) {
            story.attachedStory = undefined;
        }

        story.media = removeItems(story.media, {
            "mediaType": null,
            "mediaID": null,
            "filename": null,
            "isPlayable": null,
            "accessibilityCaption": null,
            "title": null,
            "url": null,
            "needsVideoDownload": null
        });
        story.shares = removeItems(story.shares, {
            "description": null,
            "title": null,
            "url": null,
            "media": {
                "mediaType": null,
                "mediaID": null,
                "filename": null,
                "isPlayable": null,
                "title": null,
                "url": null,
                "needsVideoDownload": null
            }
        });

        // Remove all the null values to reduce the size of the archive
        story = deepConvertNullToUndefined(story);
        stories.push(story);
    });

    return stories;
};

export const saveArchive = (db: Database.Database, appVersion: string, username: string, filename: string) => {
    // Build the FacebookArchive object
    const facebookArchive: FacebookArchive = {
        appVersion,
        username,
        createdAt: new Date().toISOString(),
        stories: selectStories(db),
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
        writeJSONArray(streamWriter, facebookArchive.stories, "stories");
        streamWriter.write(',\n');

        // Close the object
        streamWriter.write('};');

        streamWriter.end();
    } catch (error) {
        streamWriter.end();
        throw error;
    }
}
