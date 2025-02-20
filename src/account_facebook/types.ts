/* eslint-disable @typescript-eslint/no-explicit-any */

import { FacebookJob } from '../shared_types'

// Models

export interface FacebookJobRow {
    id: number;
    jobType: string;
    status: string;
    scheduledAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    progressJSON: string | null;
    error: string | null;
}

// Converters

export function convertFacebookJobRowToFacebookJob(row: FacebookJobRow): FacebookJob {
    return {
        id: row.id,
        jobType: row.jobType,
        status: row.status,
        scheduledAt: new Date(row.scheduledAt),
        startedAt: row.startedAt ? new Date(row.startedAt) : null,
        finishedAt: row.finishedAt ? new Date(row.finishedAt) : null,
        progressJSON: row.progressJSON ? JSON.parse(row.progressJSON) : null,
        error: row.error,
    };
}

// TODO: I think we can also get the post_type ("shared a group", "updated status", etc),
// link_url, and group_name from the content.
export interface FacebookArchivePost {
    id_str: string;
    created_at: string;
    full_text: string;
    title: string;
    // lang: string;
}

export interface FacebookArchivePostContainer {
    post: FacebookArchivePost;
}


export interface FacebookPostRow {
    id: number;
    username: string;
    postID: string;
    createdAt: string;
    text: string;
    path: string;
    addedToDatabaseAt: string;
    archivedAt: string | null;
    deletedPostAt: string | null;
    hasMedia: boolean;
}
