export interface XViewerResults {
    data: {
        viewer: {
            has_community_memberships: boolean;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            create_community_action_result: any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            user_features: any;
            user_results: {
                result: {
                    __typename: string; // "User"
                    id: string;
                    rest_id: string; // this is the userID
                    affiliates_highlighted_label: object;
                    has_graduated_access: boolean;
                    parody_commentary_fan_label: string;
                    is_blue_verified: boolean;
                    profile_image_shape: string;
                    legacy: {
                        following: boolean;
                        can_dm: boolean;
                        can_media_tag: boolean;
                        created_at: string;
                        default_profile: boolean;
                        default_profile_image: boolean;
                        description: string;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        entities: any;
                        fast_followers_count: number;
                        favourites_count: number; // likes count
                        followers_count: number; // followers count
                        friends_count: number; // following count
                        has_custom_timelines: boolean;
                        is_translator: boolean;
                        listed_count: number;
                        location: string;
                        media_count: number;
                        name: string; // name
                        needs_phone_verification: boolean;
                        normal_followers_count: number;
                        pinned_tweet_ids_str: string[];
                        possibly_sensitive: boolean;
                        profile_banner_url: string;
                        profile_image_url_https: string; // profile picture
                        profile_interstitial_type: string;
                        screen_name: string; // username
                        statuses_count: number; // tweets count
                        translator_type: string;
                        verified: boolean;
                        want_retweets: boolean;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        withheld_in_countries: any;
                    };
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tipjar_settings: any;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    legacy_extended_profile: any;
                    is_profile_translatable: boolean;
                    super_follows_application_status: string;
                    creator_subscriptions_count: number;
                };
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            educationFlags: any;
            is_tfe_restricted_session: boolean;
            is_active_creator: boolean;
            super_followers_count: number;
        };
        is_super_follow_subscriber: boolean;
    };
}

export interface XUserInfo {
    username: string;
    userID: string;
    profileImageDataURI: string;
    followingCount: number;
    followersCount: number;
    tweetsCount: number;
    likesCount: number;
}