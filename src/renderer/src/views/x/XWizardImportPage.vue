<script setup lang="ts">
import {
    AccountXViewModel,
    State
} from '../../view_models/AccountXViewModel'

import XLastImportOrBuildComponent from './XLastImportOrBuildComponent.vue';
import { openURL } from '../../util';

// Props
defineProps<{
    model: AccountXViewModel;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
}>()

// Buttons

const importClicked = async () => {
    emit('setState', State.WizardImporting);
};

const backClicked = async () => {
    emit('setState', State.WizardImportOrBuild);
};
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Import your X archive
            </h2>
            <p class="text-muted">
                Before you can import your X archive, you need to download it by following these steps:
            </p>
            <ul class="x-archive-steps">
                <li>
                    <strong>Visit <a href="#" @click="openURL('https://x.com/settings/download_your_data')">
                            https://x.com/settings/download_your_data</a>.</strong><br>
                    <small class="text-muted">You might need to sign in to X first.</small>
                </li>
                <li>
                    <strong>Prove your identity.</strong><br>
                    <small class="text-muted">You'll probably need to type your X password. You might also need to get
                        a verification code sent to your email, or do other things to verify your identity.</small>
                </li>
                <li>
                    <strong>Click the "Request archive" button.</strong>
                </li>
                <li>
                    <strong>Be patient.</strong><br>
                    <small class="text-muted">After requesting your archive, you'll need to wait <strong>at least a
                            day</strong>, and maybe longer. Sorry!</small>
                </li>
                <li>
                    <strong>When it's ready, download the ZIP file from X.</strong><br>
                    <small class="text-muted">After you've followed these steps and you have your archive ZIP file,
                        click the button below.</small>
                </li>
            </ul>

            <div class="buttons mb-4">
                <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="!(
                    model.account?.xAccount?.archiveTweets ||
                    model.account?.xAccount?.archiveLikes ||
                    model.account?.xAccount?.archiveDMs)" @click="importClicked">
                    <i class="fa-solid fa-file-import" />
                    I've Downloaded My Archive from X
                </button>

                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Import or Build Database
                </button>
            </div>

            <XLastImportOrBuildComponent :account-i-d="model.account.id" :button-text="'Go to Delete Options'"
                :button-text-no-data="'Skip to Delete Options'" :button-state="State.WizardDeleteOptions"
                @set-state="emit('setState', $event)" />
        </div>
    </div>
</template>

<style scoped>
ul.x-archive-steps {
    list-style-type: none;
    padding: 0 1em;
}

ul.x-archive-steps li {
    margin-bottom: 1em;
}
</style>