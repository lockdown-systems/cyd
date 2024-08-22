<script setup lang="ts">
</script>

<template>
  <template v-if="dbInitialized">
    <nav>
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link>
    </nav>
    <router-view />
  </template>
  <template v-else>
    <div class="d-flex justify-content-center align-items-center vh-100">
      <div class="container">
        <div class="text-center">
          <img src="./assets/logo.png" alt="Logo" class="img-fluid mb-4">
        </div>
        <div class="form-group select-sqlite">
          <label for="dbFileInput" class="form-label mt-3">To view your X archive, select your <code>data.sqlite3</code>
            file below</label>
          <input type="file" class="form-control mt-3" id="dbFileInput">
        </div>
      </div>
    </div>
  </template>
</template>

<style>
.select-sqlite {
  text-align: center;
}

.select-sqlite label {
  font-weight: bold;
  font-size: 1.5rem;
}

.select-sqlite input {
  display: block;
  margin: 0 auto;
  max-width: 400px;
}
</style>
