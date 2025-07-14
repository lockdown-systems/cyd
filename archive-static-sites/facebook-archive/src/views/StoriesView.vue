<script setup lang="ts">
import { Ref, inject, ref, computed } from "vue";
import { FacebookArchive } from "../types";
import StoryComponent from "../components/StoryComponent.vue";

const archiveData = inject("archiveData") as Ref<FacebookArchive>;

const filterText = ref("");

const filteredStories = computed(() => {
  if (!archiveData.value?.stories) {
    console.log("No stories found in archive data:", archiveData.value);
    return [];
  }
  return archiveData.value.stories.filter((story) => {
    const s = filterText.value.toLowerCase();

    return (
      (story.text && story.text.toLocaleLowerCase().includes(s)) ||
      (story.title && story.title.toLocaleLowerCase().includes(s)) ||
      (story.lifeEventTitle &&
        story.lifeEventTitle.toLocaleLowerCase().includes(s)) ||
      story.user.name.toLocaleLowerCase().includes(s) ||
      (story.attachedStory &&
        story.attachedStory.text &&
        story.attachedStory.text.toLocaleLowerCase().includes(s))
    );
  });
});
</script>

<template>
  <div class="posts-container">
    <div class="filter-container">
      <p>
        <input
          v-model="filterText"
          type="text"
          class="form-control"
          placeholder="Filter your posts"
        />
      </p>
      <p class="text-center text-muted small">
        Showing {{ filteredStories.length.toLocaleString() }} posts
      </p>
    </div>

    <div class="posts-list">
      <StoryComponent
        v-for="story in filteredStories"
        :key="story.storyID"
        :story="story"
      />
    </div>
  </div>
</template>

<style scoped>
.posts-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 150px);
  max-width: 700px;
  margin: 0 auto;
}

.filter-container {
  flex-shrink: 0;
}

.posts-list {
  flex-grow: 1;
  overflow-y: auto;
  padding: 0 20px;
}
</style>
