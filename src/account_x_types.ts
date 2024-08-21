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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entities: any;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entities: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pinned_tweet_ids_str: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tipjar_settings?: any;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        tipjar_settings?: any;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        affiliates_highlighted_label?: any;
                    }
                }
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            unmention_data?: any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            edit_control?: any,
            is_translatable?: boolean,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            views?: any,
            source?: string,
            legacy?: XAPILegacyTweet;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            limitedActionResults?: any;
        };
        is_translatable?: boolean;
        legacy?: XAPILegacyTweet;
        rest_id?: string;
        source?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        edit_control?: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unmention_data?: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        views?: any;
    }
}

export interface XAPIItemContent {
    __typename: string;
    itemType: string; // "TimelineTweet", "TimelineUser"
    tweetDisplayType?: string;
    tweet_results?: XAPITweetResults;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user_results?: any;
}

export interface XAPIData {
    data: {
        user: {
            result: {
                __typename: string; // "User"
                timeline_v2: {
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
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            clientEventInfo: any;
                                        };
                                    }[];
                                    // itemContent is there when entryType is "TimelineTimelineItem"
                                    itemContent?: XAPIItemContent;
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    clientEventInfo?: any;
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    metadata?: any;
                                };
                                entryId: string;
                                sortIndex: string;
                            }[];
                        }[];
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        metadata: any;
                    }
                }
            }
        }
    }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    location: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    description: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    url: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entities: any,
    protected: boolean,
    followers_count: number,
    friends_count: number,
    listed_count: number,
    created_at: string,
    favourites_count: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    utc_offset: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    time_zone: any,
    geo_enabled: boolean,
    verified: boolean,
    statuses_count: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    can_dm: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withheld_in_countries: any,
    followed_by: boolean,
}

export interface XAPIInboxTimeline {
    inbox_timeline: {
        status: string,
        min_entry_id: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entries: any,
        users: {
            [key: string]: XAPIUser
        },
        conversations: {
            [key: string]: XAPIConversation
        },
    }
}

export interface XAPIInboxInitialState {
    inbox_initial_state?: {
        last_seen_event_id: string,
        trusted_last_seen_event_id: string,
        untrusted_last_seen_event_id: string,
        cursor: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inbox_timelines: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entries: any,
        users: {
            [key: string]: XAPIUser
        },
        conversations: {
            [key: string]: XAPIConversation
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        key_registry_state: any;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            entities?: any;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message_reactions: any
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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