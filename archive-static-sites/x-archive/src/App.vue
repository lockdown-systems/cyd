<script setup lang="ts">
import { ref, onMounted, provide } from 'vue'
import { formattedDate } from './helpers'
import { XArchive } from './types'

const archiveDataFound = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const archiveData = ref<XArchive>((window as any).archiveData);
provide('archiveData', archiveData);

onMounted(() => {
  // Make sure the archive data is there
  archiveDataFound.value = 'archiveData' in window;
})
</script>

<template>
  <template v-if="archiveDataFound">
    <div class="d-flex flex-column min-vh-100">
      <nav class="navbar navbar-expand-lg navbar-light bg-light fixed-top">
        <div class="container-fluid">
          <a class="navbar-brand" href="https://cyd.social" target="_blank">
            <img src="./assets/logo.png" alt="Cyd" class="logo" style="height: 40px;">
          </a>
          <span class="navbar-text">
            <i class="fa-brands fa-x-twitter"></i> Archive: <b>@{{ archiveData.username }}</b>
          </span>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
            aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ms-auto">
              <li class="nav-item">
                <router-link to="/" class="nav-link">Tweets</router-link>
              </li>
              <li class="nav-item">
                <router-link to="/likes" class="nav-link">Likes</router-link>
              </li>
              <li class="nav-item">
                <router-link to="/messages" class="nav-link">Messages</router-link>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <div class="container main-content mb-2">
        <router-view />
      </div>
      <footer class="mt-auto bg-light py-3">
        <div class="container">
          <p class="text-center mb-0">Archive created with <a href="https://cyd.social/">Cyd</a> v{{
            archiveData.appVersion }} | Exported {{
              formattedDate(archiveData.createdAt) }}</p>
        </div>
      </footer>
    </div>
  </template>
  <template v-else>
    <div class="archive-data-missing d-flex justify-content-center align-items-center vh-100">
      <div class="container">
        <div class="text-center">
          <img src="./assets/logo.png" alt="Cyd" class="img-fluid mb-4">
          <i class="fa-solid fa-triangle-exclamation" />
        </div>
        <p class="text-center">
          Uh oh! <code>assets/archive.js</code> is missing, so I cannot display your archive.
        </p>
        <p class="text-center">Try archiving your X data with Cyd again.</p>
      </div>
    </div>
  </template>
</template>

<style>
html,
body {
  height: 100%;
  margin: 0;
}

a {
  color: #007bff;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

footer p {
  font-size: 0.8rem;
  color: #666666;
}

.archive-data-missing {
  font-size: 1.5rem;
}

.archive-data-missing i {
  color: red;
  font-size: 3.5rem;
  margin: 0 1rem;
}

.main-content {
  margin-top: 80px;
}
</style>
