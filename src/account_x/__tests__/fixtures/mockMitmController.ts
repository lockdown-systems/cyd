import path from "path";

import { TestMITMController } from "../../../__tests__/platform-fixtures/mitmControllerFactory";
import type { ResponseData } from "../../../shared_types";

export class XMockMITMController extends TestMITMController {
  constructor() {
    super();
  }

  setTestdata(testdata?: string) {
    switch (testdata) {
      case "indexTweets":
        this.responseData = this.loadResponseSequence([
          {
            relativePath: path.join("x", "XUserTweetsAndReplies1.json"),
            url: "/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?",
          },
          {
            relativePath: path.join("x", "XUserTweetsAndReplies2.json"),
            url: "/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?",
          },
          {
            relativePath: path.join("x", "XUserTweetsAndReplies3.json"),
            url: "/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?",
          },
          {
            relativePath: path.join("x", "XUserTweetsAndReplies18.json"),
            url: "/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?",
          },
        ]);
        break;
      case "indexTweetsMedia":
        this.responseData = this.loadResponseSequence([
          {
            relativePath: path.join("x", "XUserTweetsAndRepliesMedia.json"),
            url: "/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?",
          },
        ]);
        break;
      case "indexDMs":
        this.responseData = this.loadResponseSequence([
          {
            relativePath: path.join("x", "XAPIDMInboxTimeline1.json"),
            url: "/i/api/1.1/dm/inbox_timeline/trusted.json?filter_low_quality=false&include_quality=all&max_id=1737890608109486086&nsfw_filtering_enabled=false&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=false&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_ext_edit_control=true&ext=mediaColor%2CaltText%2CbusinessAffiliationsLabel%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle",
          },
          {
            relativePath: path.join("x", "XAPIDMInitialInboxState.json"),
            url: "/i/api/1.1/dm/inbox_initial_state.json?nsfw_filtering_enabled=false&filter_low_quality=false&include_quality=all&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=true&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_ext_edit_control=true&include_ext_business_affiliations_label=true&ext=mediaColor%2CaltText%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle",
          },
          {
            relativePath: path.join("x", "XAPIDMConversation1.json"),
            url: "/i/api/1.1/dm/conversation/96752784-1209344563589992448.json?context=FETCH_DM_CONVERSATION&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=false&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_conversation_info=true&ext=mediaColor%2CaltText%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle",
          },
          {
            relativePath: path.join("x", "XAPIDMConversation2.json"),
            url: "/i/api/1.1/dm/conversation/96752784-1209344563589992448.json?context=FETCH_DM_CONVERSATION&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=false&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_conversation_info=true&ext=mediaColor%2CaltText%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle",
          },
        ]);
        break;
      case "indexBookmarks":
        this.responseData = this.loadResponseSequence([
          {
            relativePath: path.join("x", "XBookmarks.json"),
            url: "/i/api/graphql/Ds7FCVYEIivOKHsGcE84xQ/Bookmarks?",
          },
        ]);
        break;
      default:
        this.responseData = [];
    }
  }

  setTestdataFromFile(filename: string, url: string) {
    this.responseData = this.loadResponseSequence([
      {
        relativePath: path.join("x", filename),
        url,
      },
    ]);
  }

  setAutomationErrorReportTestdata(filename: string) {
    const payload = this.readJSONFixture<{ latestResponseData: ResponseData }>(
      path.join("automation-errors", filename),
    );
    this.responseData = [payload.latestResponseData];
  }
}
