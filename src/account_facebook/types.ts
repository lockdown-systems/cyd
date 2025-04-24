/* eslint-disable @typescript-eslint/no-explicit-any */

import { FacebookJob } from '../shared_types'

// ======
// Models
// ======

// Represents Cyd jobs
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

// Facebook user
export interface FacebookUserRow {
    id: number;
    userID: string;
    url: string;
    name: string;
    // We download the profile picture and save it to the filesystem, and save the path to the file here
    // To make unique filenames, this will be the userID + the file extension
    profilePictureFilename: string;
}

// Facebook story
export interface FacebookStoryRow {
    id: number;
    storyID: string;
    url: string;
    createdAt: string;
    // node.message.text
    text?: string;
    // node.title.text (for messages like "{name} updated his cover photo.")
    title?: string;
    // if node.attachments[0].style_type_renderer.__typename is StoryAttachmentLifeEventStyleRenderer,
    // node.attachments[0].style_type_renderer.attachment.style_infos[0].life_event_title
    lifeEventTitle?: string;
    // comet_sections.actor_photo.story.actors[0].id
    // (TODO: how do we handle more than one actor?)
    userID: string;
    // If there's an attached_story
    attachedStoryID?: number; // Foreign key to attachedStory.id
    
    // Cyd metadata
    addedToDatabaseAt: string;
    archivedAt: string | null;
    deletedPostAt: string | null;
}

// Facebook attached story
export interface FacebookAttachedStoryRow {
    id: number;
    storyID: string;
    text: string;
}

// Facebook media
export interface FacebookMediaRow {
    id: number;
    storyID: string;  // Foreign key to story.storyID, or to attachedStory.storyID
    mediaType: string; // "Photo", "Video", "GenericAttachmentMedia" (for an attached reel)
    mediaID: string;
    // We download the media and save it to the filesystem, and save the path to the file here
    // To make unique filenames, this will be the mediaID + the file extension
    filename: string;
    // If it's Photo
    isPlayable?: boolean;
    accessibilityCaption?: string;
    // If it's a GenericAttachmentMedia
    title?: string;
    url?: string;
}

// Join table for Facebook stories and media
export interface FacebookMediaStoryRow {
    id: number;
    storyID: string;  // Foreign key to story.storyID
    mediaID: string;  // Foreign key to media.mediaID
}

// Join table for Facebook attached stories and media
export interface FacebookMediaAttachedStoryRow {
    id: number;
    storyID: string;  // Foreign key to attached_story.storyID
    mediaID: string;  // Foreign key to media.mediaID
}

// Facebook shares (links, both internal and external)
// attachment_type: FBShortsShareAttachment
// attachment_type: ExternalShareAttachment
// attachment_type: StoryAttachmentShareStyleRenderer -- a link, but the URL is not in the API response
export interface FacebookShareRow {
    id: number;
    storyID: string;  // Foreign key to story.storyID
    description: string; // node.attachments[0].style_type_renderer.attachment.description.text
    title: string; // node.attachments[0].style_type_renderer.attachment.title
    url: string; // node.attachments[0].style_type_renderer.attachment.url
    mediaID: string; // Foreign key to media.mediaID
}

// TODO: For attachments, when mediaType is "Video", the download URL is not displayed in the API response,
// so we need to figure out how to get it. Same is true when mediaType is "GenericAttachmentMedia" (for an attached reel)
// When __typename is "StoryAttachmentShareStyleRenderer", the attachment is a link, but the URL is not in the API response.

// ==========
// Converters
// ==========

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

// ==================
// Facebook API types
// ==================

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
    image?: {
        uri: string;
        height: number;
        width: number;
    };
    fallback_image?: {
        uri: string;
    };
    is_playable?: boolean;
    id: string;
    accessibility_caption?: string;
    focus?: {
        x: number;
        y: number;
    };
    __isNode?: string;
}

export interface FBAttachment {
    style_type_renderer: {
        // StoryAttachmentPhotoStyleRenderer: single photo
        // StoryAttachmentAlbumStyleRenderer: multiple photos
        // StoryAttachmentFallbackStyleRenderer: attached story (like a reel, or a link)
        // StoryAttachmentLifeEventStyleRenderer: life event (like a birthday)
        __typename: string;
        __isStoryAttachmentStyleRendererUnion?: string;
        is_prod_eligible?: boolean;
        // FBShortsShareAttachment (if __typename is StoryAttachmentFallbackStyleRenderer)
        // ExternalShareAttachment (if __typename is StoryAttachmentFallbackStyleRenderer)
        attachment_type?: string;
        attachment: {
            title?: string;
            url?: string;
            media?: FBMedia;
            source?: {
                delight_ranges: any[];
                image_ranges: any[];
                inline_style_ranges: any[];
                aggregated_ranges: any[];
                ranges: any[];
                color_ranges: any[];
                text: string; // "Facebook", "starfewvalleywiki.com", etc.
            };
            description?: {
                delight_ranges: any[];
                image_ranges: any[];
                inline_style_ranges: any[];
                aggregated_ranges: any[];
                ranges: any[];
                color_ranges: any[];
                text: string;
            };
            all_subattachments?: {
                count: number;
                nodes: { media: FBMedia; }[];
            };
            // on StoryAttachmentLifeEventStyleRenderer
            actor?: any;
            subattachments?: any[];
            style_infos?: {
                __typename: string;
                animated_icon_url?: string;
                icon_id?: string;
                icon_url?: string;
                life_event_title?: string; // "Born on February 12, 1983"
                third_person_title?: string; // "Chase Westbrook Was Born on February 12, 1983"
            }[];
        };
        __module_operation_ProfileCometTimelineGridStoryAttachment_story: any;
        __module_component_ProfileCometTimelineGridStoryAttachment_story: any;
    };
}

export interface FBAPIExtensions {
    is_final: boolean;
    prefetch_uris_v2?: any;
    sr_payload?: any;
}

export interface FBAPINode {
    __typename: string; // "Story"
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

// Manage Posts types that we care about

// ProfileCometManagePostsTimelineRootQuery types:
// - FBAPIResponseProfileCometManagePostsTimelineRootQuery1
// - FBAPIResponseProfileCometManagePostsTimelineRootQuery2
// - FBAPIResponseProfileCometManagePostsTimelinePageInfo

// CometManagePostsFeedRefetchQuery types:
// - FBAPIResponseCometManagePostsFeedRefetchQuery
// - FBAPIResponseProfileCometManagePostsTimelinePageInfo

// ProfileCometManagePostsTimelineRootQuery (1st json object in the response)
export interface FBAPIResponseProfileCometManagePostsTimelineRootQuery1 {
    data: {
        user: {
            timeline_manage_feed_units: {
                edges: {
                    node: FBAPINode,
                    cursor: string;
                }[];
            };
            id: string;
            profile_pinned_post: any;
        }
    },
    extensions: FBAPIExtensions;
}

// ProfileCometManagePostsTimelineRootQuery (2nd json object in the response)
export interface FBAPIResponseProfileCometManagePostsTimelineRootQuery2 {
    label: string; // 'ProfileCometManagePostsTimelineFeed_user$stream$CometManagePostsFeed_user_timeline_manage_feed_units'
    path: (string | number)[];
    data: {
        node: FBAPINode;
        cursor: string;
    };
    extensions: FBAPIExtensions;
}

// CometManagePostsFeedRefetchQuery (1st json object in the response)
export interface FBAPIResponseCometManagePostsFeedRefetchQuery {
    data: {
        node: FBAPINode;
    };
    extensions: FBAPIExtensions;
}

// ProfileCometManagePostsTimelineRootQuery, CometManagePostsFeedRefetchQuery
// (last json object in the response, includes extensions.is_final == true)
// this can be ignored
export interface FBAPIResponseProfileCometManagePostsTimelinePageInfo {
    label: string; // 'ProfileCometManagePostsTimelineFeed_user$defer$CometManagePostsFeed_user_timeline_manage_feed_units$page_info'
    path: (string | number)[];
    data: {
        page_info: any;
    };
    extensions: FBAPIExtensions;
}
