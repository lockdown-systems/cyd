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
    isReposted: boolean;
    media?: FacebookArchiveMedia[];  // Media attachments
    urls?: string[];  // URLs in the post
    // lang: string;
}

export interface FacebookArchiveMedia {
    uri: string;
    type: 'photo' | 'video';
    description?: string;  // Some media items have descriptions
    creationTimestamp?: number;  // From media.creation_timestamp
}

export interface FacebookPostRow {
    id: number;
    username: string;
    postID: string;
    createdAt: string;
    title: string;
    text: string;
    path: string;
    addedToDatabaseAt: string;
    archivedAt: string | null;
    deletedPostAt: string | null;
    hasMedia: boolean;
    isReposted: boolean;
    repostID: string | null;
    urls?: string[];
}

export interface FacebookPostMediaRow {
    mediaId: string;
    postId: string;  // Foreign key to post.postID
    type: string;
    uri: string;
    description: string | null;
    createdAt: string | null;
    addedToDatabaseAt: string;
}

export interface FacebookPostWithMedia extends FacebookPostRow {
    media?: FacebookPostMediaRow[];
}


// Facebook API types

export interface FBAPIPrivacyRowInput {
    allow: any[];
    base_state: string; // `FRIENDS`
    deny: any[];
    privacy_targeting: any;
    tag_expansion_state: string; // `UNSPECIFIED`
};

export interface FBAPIActor {
    __typename: string;
    __isActor: string;
    id: string;
    __isEntity: string;
    url: string;
    work_foreign_entity_info: any;
    work_info: any;
    story_bucket: any;
    live_video_for_comet_live_ring: any;
    answer_agent_group_id: any;
    profile_url: string;
    name: string;
    profile_picture: {
        uri: string;
        width: number;
        height: number;
        scale: number;
    };
    is_additional_profile_plus: boolean;
    delegate_page: any;
}

export interface FBMedia {
    __typename: string;
    image: {
        uri: string;
        height: number;
        width: number;
    };
    fallback_image?: {
        uri: string;
    };
    is_playable: boolean;
    id: string;
    accessibility_caption: string;
    focus: {
        x: number;
        y: number;
    };
    __isNode: string;
}

export interface FBAttachment {
    style_type_renderer: {
        __typename: string;
        attachment_type: string;
        attachment: {
            title?: string;
            url?: string;
            media?: FBMedia;
            description?: {
                text: string;
            };
            all_subattachments?: {
                count: number;
                nodes: {media: FBMedia;}[];
            };
        };
        __module_operation_ProfileCometTimelineGridStoryAttachment_story: any;
        __module_component_ProfileCometTimelineGridStoryAttachment_story: any;
    };
}

export interface FBAPINode {
    __typename: string;
    id: string;
    comet_sections?: {
        actor_photo: {
            __typename: string;
            __isICometStorySection: string;
            is_prod_eligible: boolean;
            story: {
                actors: FBAPIActor[];
                comet_sections: any;
                attachments: any[];
                ads_data: any;
                id: string;
            };
            has_commerce_attachment: boolean;
            __module_operation_CometFeedStoryActorPhotoSectionMatchRenderer_story: any;
            __module_component_CometFeedStoryActorPhotoSectionMatchRenderer_story: any;
        };
        audience: {
            __typename: string;
            __isICometStorySection: string;
            is_prod_eligible: boolean;
            story: {
                privacy_scope: {
                    privacy_scope_renderer: {
                        __typename: string;
                        __isPrivacySelectorRenderer: string;
                        privacy_row_input: FBAPIPrivacyRowInput;
                        scope: {
                            selected_row_override: any;
                            selected_option: {
                                privacy_row_input: FBAPIPrivacyRowInput;
                                id: string;
                            };
                            can_viewer_edit: boolean;
                            privacy_write_id: string;
                        };
                        id: string;
                        entry_point_renderer: any;
                        __module_operation_CometPrivacySelectorForScope_scope: any;
                        __module_component_CometPrivacySelectorForScope_scope: any;
                    }
                };
                narrative_thread_metadata: any;
                id: string;
            };
            __module_operation_CometFeedStoryAudienceSection_story: any;
            __module_component_CometFeedStoryAudienceSection_story: any;
        };
        timestamp: {
            __typename: string;
            __isICometStorySection: string;
            is_prod_eligible: boolean;
            override_url: any;
            video_override_url: any;
            story: {
                creation_time: number;
                url: string;
                ghl_label: any;
                id: string;
            };
            __module_operation_CometFeedStoryTimestampSection_story: any;
            __module_component_CometFeedStoryTimestampSection_story: any;
        };
        aggregated_story: any;
        message: {
            __typename: string;
            story: {
                message: {
                    delight_ranges: any[];
                    image_ranges: any[];
                    inline_style_ranges: any[];
                    aggregated_ranges: any[];
                    ranges: any[];
                    color_ranges: any[];
                    text: string;
                };
                id: string;
            };
        };
        __module_operation_ProfileCometTimelineGridStoryAttachment_story__message: any;
        __module_component_ProfileCometTimelineGridStoryAttachment_story__message: any;
    };
    encrypted_tracking: string;
    message: {
        text: string;
    };
    summary: any;
    url: string;
    title: any;
    attachments: FBAttachment[];
    attached_story?: null | {
        attachments: FBAttachment[];
        comet_sections: {
            aggregated_stories: any;
            message: null | {
                text: string;
            };
        };
        id: string;
    };
    creation_time: number;
    backdated_time: null | number;
    can_viewer_delete: boolean;
    negative_feedback_actions: any;
    __isNode: string;
}

export interface FBAPIResponse {
    label?: string;
    path?: (string | number)[];
    data?: {
        user?: {
            timeline_manage_feed_units: {
                edges: {
                    node: FBAPINode,
                    cursor: string;
                }[];
            };
            id: string;
            profile_pinned_post: any;
        };
        node?: FBAPINode;
        page_info?: {
            end_cursor: string;
            has_next_page: boolean;
        }
    };
    extensions?: any;
}
