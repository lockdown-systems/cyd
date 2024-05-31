<script setup lang="ts">
defineProps({
    userEmail: {
        type: String,
    }
});
</script>

<template>
    <header class="d-flex flex-column flex-md-row justify-content-between align-items-center p-2 bg-light">
        <div class="d-flex align-items-center mb-2 mb-md-0">
            <img class="logo mr-2" src="/logo.png" alt="Semiphemeral Logo">
            <h1 class="h4 mb-0">Semiphemeral</h1>
        </div>
        <template v-if="userEmail != ''">
            <div class="d-flex align-items-center">
                <div class="mr-2">
                    <i class="fa-regular fa-face-smile"></i>
                    {{ userEmail }}
                </div>
                <div>
                    <button class="btn btn-secondary btn-sm mr-2">Sign out</button>
                    <button class="btn btn-secondary btn-sm"><i class="fa-solid fa-gear"></i></button>
                </div>
            </div>
        </template>
    </header>
</template>

<style scoped>
header .logo {
    max-height: 2.2rem;
}
</style>