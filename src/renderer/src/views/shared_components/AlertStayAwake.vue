<script setup lang="ts">
import { openPreventSleepURL } from "../../util";
</script>

<template>
  <div class="alert alert-info mt-4" role="alert">
    <p class="fw-bold mb-0">Your computer needs to be awake to use Cyd.</p>
    <p class="alert-details mb-0">
      Don't close the lid, keep it plugged in, and disable sleep while plugged
      in.
      <a href="#" @click="openPreventSleepURL">Learn more.</a>
    </p>
  </div>
</template>

<style scoped></style>
