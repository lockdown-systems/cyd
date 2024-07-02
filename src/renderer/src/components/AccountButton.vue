<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { Account } from '../../../shared_types';

const props = defineProps<{
    account: Account;
    active: boolean;
}>();

const emit = defineEmits(['onSettingsClicked', 'onDeleteClicked']);

const showInfo = ref(false);
const showMenu = ref(false);
const menuBtnEl = ref<HTMLDivElement | null>(null);
const menuPopupEl = ref<HTMLDivElement | null>(null);

const settingsClicked = () => {
    emit('onSettingsClicked', props.account);
};

const deleteClicked = () => {
    emit('onDeleteClicked', props.account);
};

const menuAuxClicked = () => {
    showMenu.value = !showMenu.value;
};

const outsideMenuClicked = (event: MouseEvent) => {
    setTimeout(() => {
        if (
            showMenu.value &&
            !menuBtnEl.value?.contains(event.target as Node) &&
            !menuPopupEl.value?.contains(event.target as Node)
        ) {
            showMenu.value = false;
        }
    }, 100);
};

onMounted(async () => {
    document.addEventListener('click', outsideMenuClicked);
    document.addEventListener('auxclick', outsideMenuClicked);
});

onUnmounted(async () => {
    document.removeEventListener('click', outsideMenuClicked);
    document.removeEventListener('auxclick', outsideMenuClicked);
});
</script>

<template>
    <div class="btn-container" :class="{ 'active': active }">
        <div ref="menuBtnEl" class="account-btn d-flex justify-content-center align-items-center"
            @mouseover="showInfo = true" @mouseleave="showInfo = false" @auxclick="menuAuxClicked">
            <template v-if="props.account.type == 'unknown'">
                <i class="fa-solid fa-gears" />
            </template>
            <template v-else-if="props.account.type == 'X'">
                <i class="fa-brands fa-x-twitter" />
            </template>
        </div>
        <div v-if="showInfo" class="info-popup">
            <template v-if="props.account.type == 'unknown'">
                Delete data from a new account
            </template>
            <template v-else-if="props.account.type == 'X'">
                <template v-if="props.account.xAccount?.username == null">
                    Login to your X account
                </template>
                <template v-else>
                    @{{ props.account.xAccount?.username }}
                </template>
            </template>
        </div>
        <div v-if="showMenu" ref="menuPopupEl" class="menu-popup">
            <ul>
                <li class="menu-btn" @click="settingsClicked">
                    Settings
                </li>
                <li class="menu-btn" @click="deleteClicked">
                    Delete
                </li>
            </ul>
        </div>
    </div>
</template>

<style scoped>
.btn-container .account-btn {
    opacity: 0.5;
}

.btn-container.active .account-btn {
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
    bottom: 4px;
    left: 45px;
}

.menu-popup {
    top: 4px;
    left: 45px;
}
</style>