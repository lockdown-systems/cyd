<script setup lang="ts">
import { getCurrentInstance } from 'vue';
import {
    AccountXViewModel,
    State
} from '../../view_models/AccountXViewModel'

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Props
const props = defineProps<{
    model: AccountXViewModel;
    userAuthenticated: boolean;
    userPremium: boolean;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
    startStateLoop: []
    startJobsJustSave: []
}>()

// Buttons
const signInClicked = async () => {
    localStorage.setItem('manageAccountMode', 'premium');
    localStorage.setItem('manageAccountRedirectAccountID', props.model.account?.id.toString());
    emitter?.emit("show-sign-in");
};

const manageAccountClicked = async () => {
    localStorage.setItem('manageAccountMode', 'premium');
    localStorage.setItem('manageAccountRedirectAccountID', props.model.account?.id.toString());
    emitter?.emit("show-manage-account");
};

const justSaveClicked = async () => {
    emit('startJobsJustSave');
};

const backClicked = async () => {
    emit('setState', State.WizardStart);
    emit('startStateLoop');
};
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto wizard-review">
        <h2 v-if="userAuthenticated && userPremium">
            Thanks for upgrading to Premium
            <i class="fa-solid fa-heart" />
        </h2>
        <h2 v-else>
            Upgrade to Premium to delete data
        </h2>

        <template v-if="!userAuthenticated">
            <p>First, sign in to your Cyd account.</p>
        </template>
        <template v-else-if="userAuthenticated && !userPremium">
            <p>Manage your account to upgrade to Premium.</p>
        </template>
        <template v-else>
            <p>Ready to delete your data from X? <em>Let's go!</em></p>
        </template>

        <form @submit.prevent>
            <div class="buttons">
                <button v-if="!userAuthenticated" type="submit" class="btn btn-lg btn-primary text-nowrap m-1"
                    @click="signInClicked">
                    <i class="fa-solid fa-user-ninja" />
                    Sign In
                </button>

                <button v-else-if="userAuthenticated && !userPremium" type="submit"
                    class="btn btn-lg btn-primary text-nowrap m-1" @click="manageAccountClicked">
                    <i class="fa-solid fa-user-ninja" />
                    Manage My Account
                </button>

                <button v-else type="submit" class="btn btn-lg btn-primary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-user-ninja" />
                    Review Your Choices
                </button>
            </div>

            <div v-if="!userPremium" class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Review
                </button>

                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" :disabled="!(
                    model.account?.xAccount?.archiveTweets ||
                    model.account?.xAccount?.archiveLikes ||
                    model.account?.xAccount?.archiveDMs)" @click="justSaveClicked">
                    <i class="fa-solid fa-floppy-disk" />
                    Just Save My Data for Now
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped></style>