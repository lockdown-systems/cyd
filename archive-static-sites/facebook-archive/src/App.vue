<script setup lang="ts">
import { ref, onMounted, provide } from "vue";
import { formattedDate } from "./helpers";
import { FacebookArchive } from "./types";

const archiveDataFound = ref(false);
const archiveData = ref<FacebookArchive>((window as any).archiveData);

provide("archiveData", archiveData);

onMounted(() => {
  // Make sure the archive data is there
  archiveDataFound.value = "archiveData" in window;
  // Set the document title
  if (archiveDataFound.value) {
    document.title = `${archiveData.value.username}'s Facebook Archive`;
  }
});
</script>

<template>
  <template v-if="archiveDataFound">
    <div class="d-flex flex-column min-vh-100">
      <nav class="navbar navbar-expand-lg navbar-light bg-light fixed-top">
        <div class="container-fluid">
          <a class="navbar-brand" href="https://cyd.social" target="_blank">
            <img
              src="./assets/icon.svg"
              alt="Cyd"
              class="icon"
              style="height: 40px"
            />
          </a>
          <span class="navbar-text">
            <i class="fa-brands fa-facebook"></i> Archive:
            <b>{{ archiveData?.username }}</b>
          </span>
          <button
            class="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span class="navbar-toggler-icon"></span>
          </button>
          <div id="navbarNav" class="collapse navbar-collapse">
            <ul class="navbar-nav ms-auto">
              <li
                v-if="
                  archiveData?.stories?.length && archiveData.stories.length > 0
                "
                class="nav-item"
              >
                <router-link to="/" class="nav-link">Posts</router-link>
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
          <p class="text-center mb-0">
            Archive created with <a href="https://cyd.social/">Cyd</a> v{{
              archiveData?.appVersion
            }}
            | Exported {{ formattedDate(archiveData?.createdAt || "") }}
          </p>
        </div>
      </footer>
    </div>
  </template>

  <template v-else>
    <div
      class="archive-data-missing d-flex justify-content-center align-items-center vh-100"
    >
      <div class="container">
        <div class="text-center">
          <img
            src="./assets/omgkevin.svg"
            alt="Error"
            class="img-fluid mb-4 error-image"
          />
        </div>
        <p class="text-center">
          Uh oh! <code>assets/archive.js</code> is missing, so I cannot display
          your archive.
        </p>
        <p class="text-center">
          Try archiving your Facebook data with Cyd again.
        </p>
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

.error-image {
  height: 300px;
}
</style>
