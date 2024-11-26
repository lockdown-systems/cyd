<script setup lang="ts">
import {
    ref,
    onMounted,
} from 'vue';
import {
    AccountXViewModel,
    State
} from '../view_models/AccountXViewModel'
import type { Account } from '../../../shared_types';

// Props
const props = defineProps<{
    model: AccountXViewModel | null;
}>();

// Emits
const emit = defineEmits<{
    updateAccount: []
    setState: [value: State]
    startStateLoop: []
}>()

// Buttons
const nextClicked = async () => {
    await saveSettings();
    if (props.model?.account.xAccount?.deleteMyData) {
        emit('setState', State.WizardDeleteOptions);
    } else {
        emit('setState', State.WizardReview);
    }
    emit('startStateLoop');
};

const backClicked = async () => {
    await saveSettings();
    emit('setState', State.WizardStart);
    emit('startStateLoop');
};

// Settings
const archiveTweets = ref(true);
const archiveTweetsHTML = ref(true);
const archiveLikes = ref(true);
const archiveDMs = ref(true);

const loadSettings = async () => {
    if (props.model && props.model.account.xAccount !== null) {
        archiveTweets.value = props.model.account.xAccount.archiveTweets;
        archiveTweetsHTML.value = props.model.account.xAccount.archiveTweetsHTML;
        archiveLikes.value = props.model.account.xAccount.archiveLikes;
        archiveDMs.value = props.model.account.xAccount.archiveDMs;
    }
};

const saveSettings = async () => {
    if (props.model?.account.xAccount == null) {
        console.error('saveSettings', 'Account is null');
        return;
    }
    const updatedAccount: Account = {
        ...props.model?.account,
        xAccount: {
            ...props.model?.account.xAccount,
            archiveTweets: archiveTweets.value,
            archiveTweetsHTML: archiveTweetsHTML.value,
            archiveLikes: archiveLikes.value,
            archiveDMs: archiveDMs.value
        }
    };
    await window.electron.database.saveAccount(JSON.stringify(updatedAccount));
    emit('updateAccount');
};

onMounted(async () => {
    await loadSettings();
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Save options
            </h2>
            <p class="text-muted">
                You can save your tweets, likes, and direct messages.
            </p>
        </div>
        <form @submit.prevent>
            <div class="mb-3">
                <div class="form-check">
                    <input id="archiveTweets" v-model="archiveTweets" type="checkbox" class="form-check-input">
                    <label class="form-check-label" for="archiveTweets">Save my tweets</label>
                </div>
            </div>
            <div class="indent">
                <div class="mb-3">
                    <div class="form-check">
                        <input id="archiveTweetsHTML" v-model="archiveTweetsHTML" type="checkbox"
                            class="form-check-input" :disabled="!archiveTweets">
                        <label class="form-check-label" for="archiveTweetsHTML">
                            Save an HTML version of each tweet
                        </label>
                    </div>
                    <div class="indent">
                        <small class="form-text text-muted">
                            Make an HTML archive of each tweet, including its replies, which is good
                            for
                            taking screenshots
                            <em>(takes longer)</em>
                        </small>
                    </div>
                </div>
            </div>
            <div class="mb-3">
                <div class="form-check">
                    <input id="archiveLikes" v-model="archiveLikes" type="checkbox" class="form-check-input">
                    <label class="form-check-label" for="archiveLikes">Save my likes</label>
                </div>
            </div>
            <div class="mb-3">
                <div class="form-check">
                    <input id="archiveDMs" v-model="archiveDMs" type="checkbox" class="form-check-input">
                    <label class="form-check-label" for="archiveDMs">Save my direct messages</label>
                </div>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Start
                </button>

                <button type="submit" class="btn btn-primary text-nowrap m-1"
                    :disabled="!(archiveTweets || archiveLikes || archiveDMs)" @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    <template v-if="props.model?.account.xAccount?.deleteMyData">
                        Continue to Delete Options
                    </template>
                    <template v-else>
                        Continue to Review
                    </template>
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped></style>