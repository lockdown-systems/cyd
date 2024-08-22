<script setup lang="ts">
import { ref, onMounted } from 'vue'

const archiveDataFound = ref(false);

onMounted(() => {
  // Make sure the archive data is there
  if (window.archiveData) {
    archiveDataFound.value = true;
  } else {
    archiveDataFound.value = false;
    return;
  }
})
</script>

<template>
  <template v-if="archiveDataFound">
    <nav>
      <img src="./assets/logo.png" alt="Semiphemeral" class="img-fluid mb-4">
      <router-link to="/">Tweets</router-link> |
      <router-link to="/messages">Messages</router-link>
    </nav>
    <router-view />
  </template>
  <template v-else>
    <div class="archive-data-missing d-flex justify-content-center align-items-center vh-100">
      <div class="container">
        <div class="text-center">
          <img src="./assets/logo.png" alt="Semiphemeral" class="img-fluid mb-4">
          <i class="fa-solid fa-triangle-exclamation" />
        </div>
        <p class="text-center">
          Uh oh! <code>assets/archive.js</code> is missing, so I cannot display your archive.
        </p>
        <p class="text-center">Try archiving your X data with Semiphemeral again.</p>
      </div>
    </div>
  </template>
</template>

<style>
.archive-data-missing {
  font-size: 1.5rem;
}

.archive-data-missing i {
  color: red;
  font-size: 3.5rem;
  margin: 0 1rem;
}
</style>
