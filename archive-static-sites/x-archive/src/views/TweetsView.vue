<script setup lang="ts">
import { Ref, inject } from 'vue'

import { XArchive } from '../types'
import TweetsDisplayComponent from '@/components/TweetsDisplayComponent.vue'

const archiveData = inject('archiveData') as Ref<XArchive>;
</script>

<template>
  <TweetsDisplayComponent :tweets="archiveData.tweets" tweetTypePlural="tweets" />
</template>

<style scoped></style>
