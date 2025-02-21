<script setup lang="ts">
import { Ref, inject, ref, computed } from 'vue'
import { FacebookArchive } from '../types'
import PostComponent from '../components/PostComponent.vue'

const archiveData = inject('archiveData') as Ref<FacebookArchive>;

const filterText = ref('');

const filteredPosts = computed(() => {
  if (!archiveData.value?.posts) {
    console.log('No posts found in archive data:', archiveData.value);
    return [];
  }
  return archiveData.value.posts.filter(post => {
    const lowerCaseFilterText = filterText.value.toLowerCase();
    const postText = post.text ? post.text.toLowerCase() : '';
    const postUsername = archiveData.value.username ? archiveData.value.username.toLowerCase() : '';
    return postText.includes(lowerCaseFilterText) || postUsername.includes(lowerCaseFilterText);
  });
});
</script>

<template>
  <div class="tweets-container">
    <div class="filter-container">
      <p><input type="text" v-model="filterText" class="form-control" placeholder="Filter your posts"></p>
      <p class="text-center text-muted small">Showing {{ filteredPosts.length.toLocaleString() }} posts</p>
    </div>

    <div class="tweets-list">
      <PostComponent v-for="post in filteredPosts" :key="post.postID" :post="post" />
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