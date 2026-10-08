import path from "path";

import { TestMITMController } from "../../../__tests__/platform-fixtures/mitmControllerFactory";
import type { ResponseData } from "../../../shared_types";

// The routes X served these operations from on 2026-09-14, identifiers and all.
export const USER_ORIGINALS_URL =
  "/i/api/graphql/z_JDHIa1yBS42jLdUH1j3A/UserOriginalsTimeline?";
export const USER_REPLIES_URL =
  "/i/api/graphql/fTdkOgyI3EJPk0Qjlv8qUw/UserRepliesTimeline?";
export const USER_REPOSTS_URL =
  "/i/api/graphql/_ApdvtK9b54C7Q1LDtMxSA/UserRepostsTimeline?";
export const LIKES_URL = "/i/api/graphql/o000A_Cp4JPOihhbeEgi0g/Likes?";
export const BOOKMARKS_URL = "/i/api/graphql/tF6KOjmZM0WGcB2Q0mfwhw/Bookmarks?";

function pages(prefix: string, count: number, url: string) {
  return Array.from({ length: count }, (_, i) => ({
    relativePath: path.join("x", `${prefix}_${i + 1}.json`),
    url,
  }));
}

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
      case "indexBookmarks":
        this.responseData = this.loadResponseSequence([
          {
            relativePath: path.join("x", "XBookmarks.json"),
            url: "/i/api/graphql/Ds7FCVYEIivOKHsGcE84xQ/Bookmarks?",
          },
        ]);
        break;
      // The capture of 2026-09-14. X split UserTweetsAndReplies into three
      // operations and moved the author fields into `core`; see
      // docs/x-capture/findings-20260914.md.
      case "indexPosts_20260914":
        this.responseData = this.loadResponseSequence(
          pages("XUserOriginalsTimeline_20260914", 4, USER_ORIGINALS_URL),
        );
        break;
      case "indexReplies_20260914":
        this.responseData = this.loadResponseSequence([
          {
            relativePath: path.join("x", "XUserRepliesTimeline_20260914.json"),
            url: USER_REPLIES_URL,
          },
        ]);
        break;
      case "indexReposts_20260914":
        this.responseData = this.loadResponseSequence([
          {
            relativePath: path.join("x", "XUserRepostsTimeline_20260914.json"),
            url: USER_REPOSTS_URL,
          },
        ]);
        break;
      case "indexLikes_20260914":
        this.responseData = this.loadResponseSequence(
          pages("XLikes_20260914", 4, LIKES_URL),
        );
        break;
      case "indexBookmarks_20260914":
        this.responseData = this.loadResponseSequence(
          pages("XBookmarks_20260914", 4, BOOKMARKS_URL),
        );
        break;
      case "indexPostsEmpty_20260914":
        this.responseData = this.loadResponseSequence([
          {
            relativePath: path.join(
              "x",
              "XUserOriginalsTimelineEmpty_20260914.json",
            ),
            url: USER_ORIGINALS_URL,
          },
        ]);
        break;
      case "indexLikesEmpty_20260914":
        this.responseData = this.loadResponseSequence([
          {
            relativePath: path.join("x", "XLikesEmpty_20260914.json"),
            url: LIKES_URL,
          },
        ]);
        break;
      case "indexBookmarksEmpty_20260914":
        this.responseData = this.loadResponseSequence([
          {
            relativePath: path.join("x", "XBookmarksEmpty_20260914.json"),
            url: BOOKMARKS_URL,
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
