<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type {
  BlueskyAsset,
  BlueskySavedRecord,
  BlueskySavedRecordSummary,
} from "../../../../../shared_types";
import { openURL } from "../../../util";

const { t } = useI18n();

const props = defineProps<{
  record: BlueskySavedRecord;
  /** Absolute file paths for saved assets, by digest. */
  mediaPaths: Record<string, string>;
}>();

/**
 * One saved record, rendered from this computer alone.
 *
 * A relationship — a repost, like, or bookmark — has nothing of its own to
 * show, so what is rendered is the record it is about, labelled by the
 * relationship. Media Cyd could not fetch is shown as absent rather than
 * quietly left out, because a gap in a backup is something to see.
 */
const relationshipLabel = computed(() => {
  switch (props.record.recordType) {
    case "app.bsky.feed.repost":
      return t("bluesky.browse.reposted");
    case "app.bsky.feed.like":
      return t("bluesky.browse.liked");
    case "app.cyd.bookmark":
      return t("bluesky.browse.bookmarked");
    default:
      return "";
  }
});

/** What the entry is really showing: the subject, when there is one. */
const shown = computed<BlueskySavedRecordSummary>(
  () => props.record.subject ?? props.record,
);

const assetSource = (asset: BlueskyAsset): string | null =>
  asset.availability === "available" && asset.digest
    ? (props.mediaPaths[asset.digest] ?? null)
    : null;

const fileURL = (filePath: string): string =>
  `file://${filePath.split("\\").join("/")}`;

const visualAssets = computed(() =>
  shown.value.assets.filter((asset) => asset.kind !== "video"),
);

const videoAssets = computed(() =>
  shown.value.assets.filter((asset) => asset.kind === "video"),
);

const authorLabel = (summary: BlueskySavedRecordSummary): string =>
  summary.author?.handle ??
  summary.author?.displayName ??
  t("bluesky.browse.unknownAuthor");
</script>

<template>
  <article class="bluesky-record card mb-3">
    <div class="card-body">
      <p v-if="relationshipLabel" class="relationship text-muted small mb-2">
        <i class="fa-solid fa-retweet me-2" />{{ relationshipLabel }}
      </p>

      <header class="d-flex align-items-center mb-2">
        <img
          v-if="shown.author?.avatar && assetSource(shown.author.avatar)"
          class="avatar me-2"
          :src="fileURL(assetSource(shown.author.avatar)!)"
          :alt="authorLabel(shown)"
        />
        <span class="author">{{ authorLabel(shown) }}</span>
        <time class="created-at text-muted small ms-auto">{{
          shown.createdAt
        }}</time>
      </header>

      <p v-if="shown.text" class="record-text">{{ shown.text }}</p>

      <p v-if="shown.sourceDeletedAt" class="source-deleted text-muted small">
        <i class="fa-solid fa-ghost me-2" />{{
          t("bluesky.browse.sourceDeleted")
        }}
      </p>

      <div v-if="visualAssets.length" class="assets d-flex flex-wrap gap-2">
        <template v-for="asset in visualAssets" :key="asset.id">
          <img
            v-if="assetSource(asset)"
            class="asset"
            :src="fileURL(assetSource(asset)!)"
            :alt="asset.altText ?? ''"
          />
          <span v-else class="asset-unavailable text-muted small">
            <i class="fa-solid fa-image-slash me-2" />{{
              t("bluesky.browse.assetUnavailable", {
                reason: asset.unavailableReason ?? "",
              })
            }}
          </span>
        </template>
      </div>

      <div v-for="asset in videoAssets" :key="asset.id" class="video mt-2">
        <video
          v-if="assetSource(asset)"
          class="asset-video"
          controls
          :src="fileURL(assetSource(asset)!)"
        />
        <span v-else class="asset-unavailable text-muted small">
          <i class="fa-solid fa-film-slash me-2" />{{
            t("bluesky.browse.assetUnavailable", {
              reason: asset.unavailableReason ?? "",
            })
          }}
        </span>
      </div>

      <div v-if="record.context.length" class="context mt-3">
        <div
          v-for="entry in record.context"
          :key="entry.kind"
          class="context-entry border-start ps-3 mb-2"
        >
          <p class="context-kind text-muted small mb-1">
            {{
              entry.kind === "reply_parent"
                ? t("bluesky.browse.replyTo")
                : entry.kind === "quote"
                  ? t("bluesky.browse.quoting")
                  : t("bluesky.browse.linkTo")
            }}
          </p>
          <template v-if="entry.record">
            <p class="context-author small mb-1">
              {{ authorLabel(entry.record) }}
            </p>
            <p class="context-text small mb-1">{{ entry.record.text }}</p>
            <p
              v-if="entry.record.sourceDeletedAt"
              class="context-deleted text-muted small mb-0"
            >
              {{ t("bluesky.browse.sourceDeleted") }}
            </p>
          </template>
          <a
            v-else-if="entry.external"
            class="context-external small"
            href="#"
            @click.prevent="openURL(entry.external.uri)"
            >{{ entry.external.title ?? entry.external.uri }}</a
          >
        </div>
      </div>

      <a
        v-if="record.sourceURL"
        class="source-link small"
        href="#"
        @click.prevent="openURL(record.sourceURL)"
        >{{ t("bluesky.browse.viewOnBluesky") }}</a
      >
    </div>
  </article>
</template>

<style scoped>
.avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
}

.asset {
  max-width: 12rem;
  max-height: 12rem;
  object-fit: cover;
}

.asset-video {
  max-width: 100%;
}

.record-text {
  white-space: pre-wrap;
}
</style>
