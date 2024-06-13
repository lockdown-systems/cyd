<script setup lang="ts">
import { onMounted, ref, inject } from 'vue'
import AccountCardX from '../components/AccountCardX.vue';

const navigate = inject('navigate') as (path: string) => void;

const xAccounts = ref<XAccount[]>([]);

const loadXAccounts = async () => {
    xAccounts.value = await (window as any).electron.getXAccounts();
}

const xAccountClicked = (xAccount: XAccount) => {
    navigate(`/account/x/${xAccount.id}`);
}

onMounted(async () => {
    await loadXAccounts();
    if (xAccounts.value.length === 0) {
        navigate('/add-service');
    }
})
</script>

<template>
    <div>
        <div class="p-2">
            <h1>Your accounts</h1>
        </div>

        <div class="d-flex flex-wrap">
            <AccountCardX v-for="(account, _) in xAccounts" :account="account" @clicked="xAccountClicked(account)" />
        </div>

        <div class="p-2">
            <button class="btn btn-primary" @click="navigate('/add-service')">Add another account</button>
        </div>
    </div>
</template>