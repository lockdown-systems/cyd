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

export interface FacebookArchivePost {
    // edit_info: any;
    // retweeted: boolean;
    // source: string;
    // entities: XAPILegacyEntities;
    // extended_entities: XAPILegacyEntities;
    // display_text_range: any;
    // favorite_count: number;
    // in_reply_to_status_id_str: string | null;
    // id_str: string;
    // in_reply_to_user_id?: string;
    // truncated: boolean;
    // retweet_count: number;
    // id: string;
    // in_reply_to_status_id?: string;
    // possibly_sensitive?: boolean;
    created_at: string;
    // favorited: boolean;
    full_text: string;
    title: string;
    // lang: string;
    // in_reply_to_screen_name?: string;
    // in_reply_to_user_id_str: string | null;
}

export interface FacebookArchivePostContainer {
    post: FacebookArchivePost;
}
