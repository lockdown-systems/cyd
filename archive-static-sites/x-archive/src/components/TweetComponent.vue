<script setup lang="ts">
import { defineProps, computed, inject, Ref } from "vue";

import {
  formattedDatetime,
  formattedDate,
  formatDateToYYYYMMDD,
} from "../helpers";
import { XArchive, Tweet } from "../types";

const props = defineProps<{
  tweet: Tweet;
}>();

const archiveData = inject("archiveData") as Ref<XArchive>;

const formattedText = computed(() => {
  let text = props.tweet.text;
  for (const url of props.tweet.urls) {
    text = text.replace(
      url.url,
      `<a href="${url.expandedURL}" target="_blank">${url.displayURL}</a>`,
    );
  }
  for (const media of props.tweet.media) {
    text = text.replace(media.url, ``);
  }
  text = text.replace(/(?:\r\n|\r|\n)/g, "<br>");
  return text.trim();
});

const quoteTweet = computed(() => {
  if (!props.tweet.quotedTweet) {
    return null;
  }
  const tweetID = props.tweet.quotedTweet.split("/").pop();
  return archiveData.value.tweets.find((t) => t.tweetID == tweetID);
});

// https://github.com/bluesky-social/atproto/discussions/2523#discussioncomment-9552109
function atUriToBlueskyUrl(atUri: string): string {
  const parts = atUri.split("/");
  if (!(parts.length === 5 && parts[0] === "at:" && parts[1] === "")) {
    throw new Error("Invalid AT URI");
  }
  const did = parts[2];
  const rkey = parts[4];
  return `https://bsky.app/profile/${did}/post/${rkey}`;
}
</script>

<template>
  <div class="tweet p-3 mb-3 border rounded">
    <div class="d-flex justify-content-between">
      <strong v-if="tweet.username">{{ tweet.username }}</strong>
      <small v-else class="text-muted">unknown user</small>
      <a
        v-if="tweet.archivedAt"
        :href="`./Archived Tweets/${formatDateToYYYYMMDD(tweet.createdAt)}_${tweet.tweetID}.html`"
        target="_blank"
        >archived</a
      >
      <a :href="`https://x.com/${tweet.path}`" target="_blank">original</a>
      <a
        v-for="atprotoURI in tweet.blueskyMigrationURIs"
        :key="atprotoURI"
        :href="atUriToBlueskyUrl(atprotoURI)"
        target="_blank"
        >migrated to Bluesky</a
      >
      <small v-if="tweet.createdAt">{{
        formattedDatetime(tweet.createdAt)
      }}</small>
      <small v-else class="text-muted">unknown date</small>
    </div>
    <div class="mt-2">
      <!-- Text -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <p v-html="formattedText"></p>
      <!-- Media -->
      <div v-if="tweet.media.length > 0">
        <div v-for="media in tweet.media" :key="media.filename" class="mt-2">
          <template
            v-if="
              media.mediaType === 'video' || media.mediaType === 'animated_gif'
            "
          >
            <video controls class="img-fluid">
              <source
                :src="`./Tweet Media/${media.filename}`"
                type="video/mp4"
              />
            </video>
          </template>
          <template v-else>
            <img :src="`./Tweet Media/${media.filename}`" class="img-fluid" />
          </template>
        </div>
      </div>
      <!-- Quote tweet -->
      <div v-if="tweet.quotedTweet" class="mt-2 p-3 border rounded">
        <small
          >Quoted tweet:
          <a :href="tweet.quotedTweet" target="_blank">{{
            tweet.quotedTweet
          }}</a></small
        >
        <template v-if="quoteTweet">
          <TweetComponent :tweet="quoteTweet" />
        </template>
      </div>
    </div>
    <div
      v-if="
        tweet.replyCount != undefined ||
        tweet.retweetCount != undefined ||
        tweet.likeCount != undefined
      "
      class="d-flex mt-2 gap-3"
    >
      <div v-if="tweet.replyCount != undefined">
        <i class="fa-solid fa-comment" />
        {{ tweet.replyCount.toLocaleString() }} replies
      </div>
      <div v-if="tweet.retweetCount != undefined">
        <i class="fa-solid fa-retweet" />
        {{ tweet.retweetCount.toLocaleString() }} retweets
      </div>
      <div v-if="tweet.likeCount != undefined">
        <i class="fa-solid fa-heart" />
        {{ tweet.likeCount.toLocaleString() }} likes
      </div>
    </div>
    <div class="meta d-flex gap-2">
      <span v-if="tweet.deletedTweetAt" class="date text-muted ms-2">
        tweet deleted {{ formattedDate(tweet.deletedTweetAt) }}
      </span>
      <span v-if="tweet.deletedRetweetAt" class="date text-muted ms-2">
        retweet deleted {{ formattedDate(tweet.deletedRetweetAt) }}
      </span>
      <span v-if="tweet.deletedLikeAt" class="date text-muted ms-2">
        like deleted {{ formattedDate(tweet.deletedLikeAt) }}
      </span>
      <span v-if="tweet.deletedBookmarkAt" class="date text-muted ms-2">
        bookmark deleted {{ formattedDate(tweet.deletedBookmarkAt) }}
      </span>
      <span v-if="tweet.archivedAt" class="date text-muted ms-2">
        archived {{ formattedDate(tweet.archivedAt) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.meta {
  font-size: 0.8rem;
}
</style>
