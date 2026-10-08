import type Database from "better-sqlite3";

import type {
  BlueskyCategory,
  BlueskyStoragePreflight,
} from "../../shared_types";
import type { BlueskyATClient } from "../at_protocol";
import { blueskyAvailableBytes } from "../storage";
import { blueskyCategoryRecordCount, pendingBlueskyAssets } from "./store";

/**
 * Deciding whether there is room to save, and being honest about what is not
 * known.
 *
 * Bluesky publishes an account's post count and nothing else: there is no
 * count of likes, reposts, or bookmarks, and no way to learn what media
 * weighs before fetching it. So a preflight offers an estimate as an estimate,
 * separates out the part it is certain about, and refuses a run only when even
 * that certain part does not fit. Refusing on a guess would block runs that
 * would have fitted; promising on a guess would fill someone's disk.
 */

/**
 * The least a saved record can take: its row, its identifiers, and the index
 * entries for them. Well under anything real, which is what makes a shortfall
 * measured against it certain.
 */
const MINIMUM_BYTES_PER_RECORD = 512;

/** What a record with typical media tends to take, media included. */
const ESTIMATED_BYTES_PER_RECORD = 256 * 1024;

/**
 * Room one asset at a time needs, plus the database's own working space. A
 * Bluesky video can be 100 MB, so a volume with less than this free cannot
 * make progress on any account.
 */
const REQUIRED_HEADROOM_BYTES = 160 * 1024 * 1024;

/** An asset already enumerated but not fetched, at its minimum plausible size. */
const MINIMUM_BYTES_PER_PENDING_ASSET = 1024;

/**
 * What a run over these categories is expected to need, against what is free.
 *
 * A category Bluesky publishes no count for contributes to the estimate from
 * what this account has already saved, and always marks the result uncertain.
 */
export const blueskyStoragePreflight = async (
  db: Database.Database,
  accountPath: string,
  client: BlueskyATClient,
  categories: BlueskyCategory[],
): Promise<BlueskyStoragePreflight> => {
  const profile = await client.getProfile();

  let certainBytes = REQUIRED_HEADROOM_BYTES;
  let estimatedBytes = REQUIRED_HEADROOM_BYTES;
  let uncertain = false;

  const reported = categories.map((category) => {
    const recordCount =
      category === "posts" ? (profile.postsCount ?? null) : null;

    // Media already enumerated is work this run certainly has to do, whether
    // it is a first run or the remains of an interrupted one.
    const pendingAssets = pendingBlueskyAssets(db, category);
    const pendingKnownBytes = pendingAssets.reduce(
      (total, asset) =>
        total + (asset.byteCount ?? MINIMUM_BYTES_PER_PENDING_ASSET),
      0,
    );
    certainBytes += pendingKnownBytes;
    estimatedBytes += pendingAssets.length * ESTIMATED_BYTES_PER_RECORD;

    if (recordCount === null) {
      uncertain = true;
      // With no published count, the best available footing is what this
      // account has already saved in the category.
      estimatedBytes +=
        blueskyCategoryRecordCount(db, category) * ESTIMATED_BYTES_PER_RECORD;
    } else {
      certainBytes += recordCount * MINIMUM_BYTES_PER_RECORD;
      estimatedBytes += recordCount * ESTIMATED_BYTES_PER_RECORD;
    }

    return { category, recordCount };
  });

  const available = blueskyAvailableBytes(accountPath);

  return {
    categories: reported,
    certainBytes,
    estimatedBytes,
    availableBytes: available ?? 0,
    // A platform that will not report free space is an unknown, not a refusal.
    uncertain: uncertain || available === null,
    sufficiency: blueskySufficiency({
      certainBytes,
      estimatedBytes,
      available,
      uncertain,
    }),
  };
};

const blueskySufficiency = (input: {
  certainBytes: number;
  estimatedBytes: number;
  available: number | null;
  uncertain: boolean;
}): BlueskyStoragePreflight["sufficiency"] => {
  if (input.available === null) {
    return "uncertain";
  }
  if (input.certainBytes > input.available) {
    return "insufficient";
  }
  if (input.uncertain || input.estimatedBytes > input.available) {
    return "uncertain";
  }
  return "sufficient";
};
