<script setup lang="ts">
import { Ref, inject } from 'vue'
import { XArchive } from './types'
import TweetComponent from '../components/TweetComponent.vue'

const archiveData = inject('archiveData') as Ref<XArchive>;
</script>

<template>
  <div class="tweets">
    <TweetComponent v-for="tweet in archiveData.tweets" :key="tweet.id" :tweet="tweet" />
  </div>
</template>

<style scoped>
.tweets {
  max-width: 600px;
  margin: 0 auto;
}
</style>