/* eslint-disable @typescript-eslint/no-explicit-any */

import { XJob, XTweetItem, XTweetItemArchive } from '../shared_types'

// Models

export interface XJobRow {
    id: number;
    jobType: string;
    status: string;
    scheduledAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    progressJSON: string | null;
    error: string | null;
}

export interface XTweetMediaRow {
    id: number;
    mediaID: string;
    tweetID: string;
    type: string;
}

export interface XTweetRow {
    id: number;
    username: string;
    tweetID: string;
    conversationID: string;
    createdAt: string;
    likeCount: number;
    quoteCount: number;
    replyCount: number;
    retweetCount: number;
    isLiked: boolean;
    isRetweeted: boolean;
    isBookmarked: boolean;
    text: string;
    path: string;
    addedToDatabaseAt: string;
    archivedAt: string | null;
    deletedTweetAt: string | null;
    deletedRetweetAt: string | null;
    deletedLikeAt: string | null;
    deletedBookmarkAt: string | null;
    hasMedia: boolean;
    isReply: boolean;
    replyTweetID: string | null;
    replyUserID: string | null;
    isQuote: boolean;
    quotedTweet: string | null;
}

export interface XUserRow {
    id: number;
    userID: string;
    name: string | null;
    screenName: string;
    profileImageDataURI: string | null;
}

export interface XConversationRow {
    id: number;
    conversationID: string;
    type: string;
    sortTimestamp: string | null;
    minEntryID: string | null;
    maxEntryID: string | null;
    isTrusted: boolean | null;
    shouldIndexMessages: boolean | null;
    addedToDatabaseAt: string;
    updatedInDatabaseAt: string | null;
    deletedAt: string | null;
}

export interface XConversationParticipantRow {
    id: number;
    conversationID: string;
    userID: string;
}

export interface XMessageRow {
    id: number;
    messageID: string;
    conversationID: string;
    createdAt: string;
    senderID: string;
    text: string;
    deletedAt: string | null;
}

// Converters

export function convertXJobRowToXJob(row: XJobRow): XJob {
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

export function convertTweetRowToXTweetItem(row: XTweetRow): XTweetItem {
    return {
        id: row.tweetID,
        t: row.text,
        l: row.likeCount,
        r: row.retweetCount,
        d: row.createdAt,
    };
}

function formatDateToYYYYMMDD(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function convertTweetRowToXTweetItemArchive(row: XTweetRow): XTweetItemArchive {
    return {
        url: `https://x.com/${row.path}`,
        tweetID: row.tweetID,
        basename: `${formatDateToYYYYMMDD(row.createdAt)}_${row.tweetID}`,
        username: row.username
    };
}

// X API types

// Index tweets

export interface XAPILegacyTweet {
    bookmark_count: number;
    bookmarked: boolean;
    created_at: string;
    conversation_id_str: string;
    display_text_range: number[];
    favorite_count: number;
    favorited: boolean;
    full_text: string;
    in_reply_to_screen_name: string;
    in_reply_to_status_id_str: string;
    in_reply_to_user_id_str: string;
    is_quote_status: boolean;
    lang: string;
    quote_count: number;
    reply_count: number;
    retweet_count: number;
    retweeted: boolean;
    user_id_str: string;
    id_str: string;
    entities: any;
    quoted_status_permalink: any;
}

export interface XAPILegacyUser {
    can_dm: boolean;
    can_media_tag: boolean;
    created_at: string;
    default_profile: boolean;
    default_profile_image: boolean;
    description: string;
    fast_followers_count: number;
    favourites_count: number;
    followers_count: number;
    friends_count: number;
    has_custom_timelines: boolean;
    is_translator: boolean;
    listed_count: number;
    location: string;
    media_count: number;
    name: string;
    needs_phone_verification: boolean;
    normal_followers_count: number;
    possibly_sensitive: boolean;
    profile_banner_url: string;
    profile_image_url_https: string;
    profile_interstitial_type: string;
    screen_name: string;
    statuses_count: number;
    translator_type: string;
    verified: boolean;
    want_retweets: boolean;
    entities: any;
    pinned_tweet_ids_str: any;
    withheld_in_countries: any;
}

export interface XAPITweetResults {
    result: {
        __typename?: string; // "Tweet", "TweetWithVisibilityResults"
        // __typename == "Tweet"
        core?: {
            user_results: {
                result?: {
                    __typename?: string;
                    has_graduated_access?: boolean;
                    id?: string;
                    is_blue_verified?: boolean;
                    legacy: XAPILegacyUser;
                    profile_image_shape?: string;
                    rest_id?: string;
                    tipjar_settings?: any;
                    affiliates_highlighted_label?: any;
                }
            }
        };
        // __typename == "TweetWithVisibilityResults"
        tweet?: {
            rest_id: string;
            core: {
                user_results: {
                    result?: {
                        __typename?: string;
                        has_graduated_access?: boolean;
                        id?: string;
                        is_blue_verified?: boolean;
                        legacy: XAPILegacyUser;
                        profile_image_shape?: string;
                        rest_id?: string;
                        tipjar_settings?: any;
                        affiliates_highlighted_label?: any;
                    }
                }
            },
            unmention_data?: any,
            edit_control?: any,
            is_translatable?: boolean,
            views?: any,
            source?: string,
            legacy?: XAPILegacyTweet;
            limitedActionResults?: any;
        };
        is_translatable?: boolean;
        legacy?: XAPILegacyTweet;
        rest_id?: string;
        source?: string;
        edit_control?: any;
        unmention_data?: any;
        views?: any;
    }
}

export interface XAPIItemContent {
    __typename: string;
    itemType: string; // "TimelineTweet", "TimelineUser"
    tweetDisplayType?: string;
    tweet_results?: XAPITweetResults;
    user_results?: any;
}

export interface XAPITimeline {
    timeline: {
        instructions: {
            type: string; // "TimelineClearCache", "TimelineAddEntries"
            entries?: {
                content: {
                    entryType: string; // "TimelineTimelineModule", "TimelineTimelineItem", "TimelineTimelineCursor"
                    __typename: string;
                    value?: string;
                    cursorType?: string;
                    displayType?: string;
                    // items is there when entryType is "TimelineTimelineModule"
                    items?: {
                        entryId: string;
                        item: {
                            itemContent: XAPIItemContent;
                            clientEventInfo: any;
                        };
                    }[];
                    // itemContent is there when entryType is "TimelineTimelineItem"
                    itemContent?: XAPIItemContent;
                    clientEventInfo?: any;
                    metadata?: any;
                };
                entryId: string;
                sortIndex: string;
            }[];
        }[];
        metadata: any;
    }
}

export interface XAPIData {
    data: {
        user: {
            result: {
                __typename: string; // "User"
                timeline_v2: XAPITimeline;
            }
        }
    }
}

export interface XAPIBookmarksData {
    data: {
        bookmark_timeline_v2: XAPITimeline;
    }
}

export function isXAPIBookmarksData(body: any): body is XAPIBookmarksData {
    return body.data && body.data.bookmark_timeline_v2;
}

export function isXAPIData(body: any): body is XAPIData {
    return body.data && body.data.user && body.data.user.result && body.data.user.result.timeline_v2;
}

// Index direct messages

export interface XAPIConversationParticipant {
    user_id: string;
    last_read_event_id: string;
};

export interface XAPIConversation {
    conversation_id: string;
    type: string; // "ONE_TO_ONE", etc.
    sort_event_id: string;
    sort_timestamp: string;
    participants: XAPIConversationParticipant[];
    nsfw: boolean;
    notifications_disabled: boolean;
    mention_notifications_disabled: boolean;
    last_read_event_id: string;
    read_only: boolean;
    trusted: boolean;
    muted: boolean;
    status: string; // "HAS_MORE", "AT_END"
    min_entry_id: string;
    max_entry_id: string;
}

export interface XAPIUser {
    id: number,
    id_str: string,
    name: string,
    screen_name: string,
    location: any,
    description: any,
    url: any,
    entities: any,
    protected: boolean,
    followers_count: number,
    friends_count: number,
    listed_count: number,
    created_at: string,
    favourites_count: number,
    utc_offset: any,
    time_zone: any,
    geo_enabled: boolean,
    verified: boolean,
    statuses_count: number,
    lang: any,
    contributors_enabled: boolean,
    is_translator: boolean,
    is_translation_enabled: boolean,
    profile_background_color: string | null,
    profile_background_image_url: string | null,
    profile_background_image_url_https: string | null,
    profile_background_tile: boolean,
    profile_image_url: string | null,
    profile_image_url_https: string | null,
    profile_banner_url: string | null,
    profile_link_color: string | null,
    profile_sidebar_border_color: string | null,
    profile_sidebar_fill_color: string | null,
    profile_text_color: string | null,
    profile_use_background_image: boolean,
    default_profile: boolean,
    default_profile_image: boolean,
    can_dm: any,
    can_secret_dm: any,
    can_media_tag: boolean,
    following: boolean,
    follow_request_sent: boolean,
    notifications: boolean,
    blocking: boolean,
    subscribed_by: boolean,
    blocked_by: boolean,
    want_retweets: boolean,
    business_profile_state: string,
    translator_type: string,
    withheld_in_countries: any,
    followed_by: boolean,
}

export interface XAPIInboxTimeline {
    inbox_timeline: {
        status: string,
        min_entry_id: string,
        entries: any,
        users: {
            [key: string]: XAPIUser
        },
        conversations: {
            [key: string]: XAPIConversation
        },
    }
}

export interface XAPIInboxInitialStateInboxTimeline {
    status: string,
    min_entry_id: string,
}

export interface XAPIInboxInitialState {
    inbox_initial_state?: {
        last_seen_event_id: string,
        trusted_last_seen_event_id: string,
        untrusted_last_seen_event_id: string,
        cursor: string,
        inbox_timelines: {
            trusted?: XAPIInboxInitialStateInboxTimeline,
            untrusted?: XAPIInboxInitialStateInboxTimeline,
            untrusted_low_quality?: XAPIInboxInitialStateInboxTimeline,
        };
        entries: any,
        users: {
            [key: string]: XAPIUser
        },
        conversations: {
            [key: string]: XAPIConversation
        },
        key_registry_state: any;
    },

    user_events: any
}

export interface XAPIMessage {
    message?: {
        id: string,
        time: string,
        request_id: string,
        conversation_id: string,
        message_data: {
            id: string,
            time: string,
            conversation_id?: string,
            recipient_id?: string,
            sender_id: string,
            text: string,
            edit_count?: number,
            entities?: any;
        },
        message_reactions: any
    },
    join_conversation?: any
}

export interface XAPIConversationTimeline {
    conversation_timeline: {
        status: string,
        min_entry_id: string,
        max_entry_id: string,
        entries?: XAPIMessage[],
        users?: {
            [key: string]: XAPIUser
        },
        conversations?: {
            [key: string]: XAPIConversation
        },
    }
}

// Gather user stats

export interface XAPIAll {
    globalObjects: {
        users: {
            [key: string]: XAPIUser
        }
    },
    timeline: any
}

// Official X Archive types

export interface XArchiveAccount {
    account: {
        email: string;
        createdVia: string;
        username: string;
        accountId: string;
        createdAt: string;
        accountDisplayName: string;
    }
}

export function isXArchiveTweetContainer(item: XArchiveTweet | XArchiveTweetContainer): item is XArchiveTweetContainer {
    return (item as XArchiveTweetContainer).tweet !== undefined;
}

export interface XArchiveTweet {
    edit_info: any;
    retweeted: boolean;
    source: string;
    entities: any;
    display_text_range: any;
    favorite_count: number;
    in_reply_to_status_id_str?: string;
    id_str: string;
    in_reply_to_user_id?: string;
    truncated: boolean;
    retweet_count: number;
    id: string;
    in_reply_to_status_id?: string;
    possibly_sensitive?: boolean;
    created_at: string;
    favorited: boolean;
    full_text: string;
    lang: string;
    in_reply_to_screen_name?: string;
    in_reply_to_user_id_str?: string;
}

export interface XArchiveTweetContainer {
    tweet: XArchiveTweet;
}

export function isXArchiveLikeContainer(item: XArchiveLike | XArchiveLikeContainer): item is XArchiveLikeContainer {
    return (item as XArchiveLikeContainer).like !== undefined;
}

export interface XArchiveLike {
    tweetId: string;
    fullText: string;
    expandedUrl: string;
}

export interface XArchiveLikeContainer {
    like: XArchiveLike;
}

export interface XArchiveDMMessage {
    participantsLeave?: any;
    joinConversation?: any,
    messageCreate?: {
        reactions: any,
        urls: any,
        text: string,
        mediaUrls: any,
        senderId: string,
        id: string,
        createdAt: string,
    }
}

export interface XArchiveDMConversation {
    dmConversation: {
        conversationId: string,
        messages: XArchiveDMMessage[],
    }
}
