<script setup lang="ts">
import { ref } from 'vue';
import type { Account } from '../../../shared_types';

const props = defineProps<{
    account: Account;
    active: boolean;
}>();

const emit = defineEmits(['clicked']);

const showInfo = ref(false);

const clicked = () => {
    emit('clicked');
};
</script>

<template>
    <div class="btn-container" :class="{ 'active': active }">
        <div class="account-btn d-flex justify-content-center align-items-center" @mouseover="showInfo = true"
            @mouseleave="showInfo = false" @click="clicked">
            <template v-if="props.account.type == 'unknown'">
                <i class="fa-solid fa-gears" />
            </template>
            <template v-else-if="props.account.type == 'X'">
                <i class="fa-brands fa-x-twitter" />
            </template>
        </div>
        <div v-if="showInfo" class="info-popup">
            <template v-if="props.account.type == 'unknown'">
                Start deleting your data
            </template>
            <template v-else-if="props.account.type == 'X'">
                <template v-if="props.account.xAccount?.username == ''">
                    Login to your X account
                </template>
                <template v-else>
                    @{{ props.account.xAccount?.username }}
                </template>
            </template>
        </div>
    </div>
</template>

<style scoped>
.btn-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    opacity: 0.7;
}

.btn-container.active {
    opacity: 1.0;
}

.account-btn {
    width: 40px;
    height: 40px;
    font-size: 25px;
    border-radius: 30%;
    cursor: pointer;
    color: white;
    background-color: black;
}

.info-popup {
    position: absolute;
    bottom: 4px;
    left: 45px;
    background-color: #000000;
    color: #ffffff;
    padding: 3px 6px;
    border-radius: 4px;
    white-space: nowrap;
}
</style>