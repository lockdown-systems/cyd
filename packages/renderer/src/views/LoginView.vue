<script setup lang="ts">
import { onMounted, ref } from 'vue';

const userEmail = ref<string>("");

onMounted(() => {
    // Get the logged in user
    (window as any).api.getConfig("userEmail").then((value: string) => {
        userEmail.value = value;
    });
});
</script>

<template>
    <div class="container p-2 h-100">
        <div class="d-flex align-items-center h-100">
            <div class="w-100">
                <div class="text-center">
                    <img src="/logo.png" class="logo mb-3" alt="Semiphemeral Logo" style="width: 120px;" />
                </div>
                <p class="lead text-muted text-center">
                    Automatically delete your old posts, except the ones you want to keep.
                </p>

                <!-- Login Form -->
                <div class="d-flex flex-column align-items-center">
                    <form class="w-50">
                        <div class="form-group d-flex flex-column align-items-center">
                            <input type="email" class="form-control" id="email" placeholder="Email address">
                            <button type="submit" class="btn btn-primary mt-2">Continue</button>
                        </div>
                    </form>
                </div>

                <p>Logged in user: {{ userEmail }}</p>
            </div>
        </div>
    </div>
</template>