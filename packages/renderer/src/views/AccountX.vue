<script setup lang="ts">
import { inject, onMounted } from 'vue'

const showBack = inject('showBack') as (text: string, navigation: string) => void;

onMounted(() => {
    showBack('Your accounts', '/dashboard');
});
</script>

<template>
    <h1>X</h1>
    <p>account {{ $route.params.id }}</p>
</template>

<style scoped></style>