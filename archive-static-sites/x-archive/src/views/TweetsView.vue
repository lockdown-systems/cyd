<script setup lang="ts">
import { Ref, inject, ref, computed } from 'vue'
import { XArchive } from '../types'
import TweetComponent from '../components/TweetComponent.vue'

const archiveData = inject('archiveData') as Ref<XArchive>;

const filterText = ref('');

const filteredTweets = computed(() => {
  return archiveData.value.tweets.filter(tweet =>
    tweet.text.toLowerCase().includes(filterText.value.toLowerCase())
  );
});
</script>

<template>
  <div class="tweets">
    <div class="mb-3">
      <input type="text" v-model="filterText" class="form-control" placeholder="Filter your tweets">
    </div>

    <p>Showing {{ filteredTweets.length.toLocaleString() }} tweets</p>

    <TweetComponent v-for="tweet in filteredTweets" :key="tweet.tweetID" :tweet="tweet" />
  </div>
</template>

<style scoped>
.tweets {
  max-width: 600px;
  margin: 0 auto;
}
</style>