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
