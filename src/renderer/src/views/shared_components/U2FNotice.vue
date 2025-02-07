<script setup lang="ts">
import { openURL } from '../../util';
</script>

<template>
    <!-- U2F security key notice -->
    <p class="u2f-info text-center text-muted small ms-2">
        <i class="fa-solid fa-circle-info me-2" />
        If you use a U2F security key (like a Yubikey) for 2FA, press it when you see a white
        screen. <a href="#" @click="openURL('https://cyd.social/docs-u2f')">Read more</a>.
    </p>
</template>

<style scoped></style>