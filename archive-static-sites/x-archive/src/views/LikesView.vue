<script setup lang="ts">
import { Ref, inject, ref, computed } from 'vue'
import { XArchive } from '../types'
import TweetComponent from '../components/TweetComponent.vue'

const archiveData = inject('archiveData') as Ref<XArchive>;

const filterText = ref('');

const filteredLikes = computed(() => {
    return archiveData.value.likes.filter(tweet => {
        const lowerCaseFilterText = filterText.value.toLowerCase();
        const tweetText = tweet.text ? tweet.text.toLowerCase() : '';
        const tweetUsername = tweet.username ? tweet.username.toLowerCase() : '';
        return tweetText.includes(lowerCaseFilterText) || tweetUsername.includes(lowerCaseFilterText);
    });
});
</script>

<template>
    <div class="tweets-container">
        <div class="filter-container">
            <p><input type="text" v-model="filterText" class="form-control" placeholder="Filter your likes"></p>
            <p class="text-center text-muted small">Showing {{ filteredLikes.length.toLocaleString() }} likes</p>
        </div>

        <div class="tweets-list">
            <TweetComponent v-for="tweet in filteredLikes" :key="tweet.tweetID" :tweet="tweet" />
        </div>
    </div>
</template>

<style scoped>
.tweets-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 150px);
    max-width: 700px;
    margin: 0 auto;
}

.filter-container {
    flex-shrink: 0;
}

.tweets-list {
    flex-grow: 1;
    overflow-y: auto;
    padding: 0 20px;
}
</style>