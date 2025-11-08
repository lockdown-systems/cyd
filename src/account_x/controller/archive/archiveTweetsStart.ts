import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type {
  XArchiveStartResponse,
  XTweetItemArchive,
  emptyXArchiveStartResponse,
} from "../../../shared_types";
import type { XTweetRow } from "../../types";
import { archiveTweetsOutputPath } from "./archiveTweetsOutputPath";
import { convertTweetRowToXTweetItemArchive } from "./convertTweetRowToXTweetItemArchive";

// When you start archiving tweets you:
// - Return the URLs path, output path, and all expected filenames
export async function archiveTweetsStart(
  controller: XAccountController,
): Promise<XArchiveStartResponse> {
  if (!controller.db) {
    controller.initDB();
  }

  if (controller.account) {
    const tweetsResp: XTweetRow[] = exec(
      controller.db!,
      "SELECT tweetID, text, likeCount, retweetCount, createdAt, path FROM tweet WHERE username = ? AND text NOT LIKE ? ORDER BY createdAt",
      [controller.account.username, "RT @%"],
      "all",
    ) as XTweetRow[];

    const items: XTweetItemArchive[] = [];
    for (let i = 0; i < tweetsResp.length; i++) {
      items.push(convertTweetRowToXTweetItemArchive(tweetsResp[i]));
    }

    return {
      outputPath: await archiveTweetsOutputPath(controller),
      items: items,
    };
  }
  return emptyXArchiveStartResponse();
}
