<script setup lang="ts">
import { defineProps, ref, computed } from "vue";

import { Tweet } from "../types";
import TweetComponent from "../components/TweetComponent.vue";

const props = defineProps<{
  tweets: Tweet[];
  tweetTypePlural: string;
}>();

const filterText = ref("");

const filterTextPlaceholder = computed(() => {
  return `Filter your ${props.tweetTypePlural}`;
});

const filteredTweets = computed(() => {
  return props.tweets.filter((tweet) => {
    const lowerCaseFilterText = filterText.value.toLowerCase();
    const tweetText = tweet.text ? tweet.text.toLowerCase() : "";
    const tweetUsername = tweet.username ? tweet.username.toLowerCase() : "";
    return (
      tweetText.includes(lowerCaseFilterText) ||
      tweetUsername.includes(lowerCaseFilterText)
    );
  });
});
</script>

<template>
  <div class="tweets-container">
    <div class="filter-container">
      <p>
        <input
          v-model="filterText"
          type="text"
          class="form-control"
          :placeholder="filterTextPlaceholder"
        />
      </p>
      <p class="text-center text-muted small">
        Showing {{ filteredTweets.length.toLocaleString() }}
        {{ tweetTypePlural }}
      </p>
    </div>

    <div class="tweets-list">
      <TweetComponent
        v-for="tweet in filteredTweets"
        :key="tweet.tweetID"
        :tweet="tweet"
      />
    </div>
  </div>
</template>

<style scoped></style>
