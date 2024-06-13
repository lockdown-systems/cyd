<script setup lang="ts">
import { ref, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router';
import SpeechBubble from '../components/SpeechBubble.vue';

const route = useRoute();
const accountID = Number(route.params.id);

const showBack = inject('showBack') as (text: string, navigation: string) => void;

const xAccount = ref<XAccount | null>(null);
const speechBubbleText = ref("");

const loadXAccount = async () => {
    const xAccounts = await (window as any).electron.getXAccounts();
    for (const account of xAccounts) {
        if (account.id === accountID) {
            xAccount.value = account;
            break;
        }
    }
}

onMounted(async () => {
    showBack('Your accounts', '/dashboard');
    await loadXAccount();

    // Sanity check
    if (xAccount.value === null) {
        speechBubbleText.value = `
I've encountered an error. It seems like the account you're looking for doesn't exist.
`;
        return
    }

    // Not logged in yet
    if (xAccount.value.username === null) {
        speechBubbleText.value = `
Excellent choice! I can help you automatically delete your tweets, likes, and direct messages, 
except for the ones you want to keep. To start, login to your X account below.
`;
    }
});
</script>

<template>
    <SpeechBubble :message="speechBubbleText" v-if="speechBubbleText != ''" />

    <h1>X</h1>
    <p>account {{ $route.params.id }}</p>
</template>

<style scoped></style>