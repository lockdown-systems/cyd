import type { XTweetRow, XTweetItemArchive } from "../../../shared_types";
import { formatDateToYYYYMMDD } from "../../../shared/utils/date-utils";

export function convertTweetRowToXTweetItemArchive(
  row: XTweetRow,
): XTweetItemArchive {
  return {
    url: `https://x.com/${row.path}`,
    tweetID: row.tweetID,
    basename: `${formatDateToYYYYMMDD(row.createdAt)}_${row.tweetID}`,
    username: row.username,
  };
}
