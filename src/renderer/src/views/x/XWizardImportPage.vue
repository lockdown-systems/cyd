<script setup lang="ts">
import {
    XViewModel,
    State
} from '../../view_models/XViewModel'

import XLastImportOrBuildComponent from './XLastImportOrBuildComponent.vue';
import { openURL } from '../../util';

// Props
defineProps<{
    model: XViewModel;
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
    emit('setState', State.WizardDatabase);
};
</script>

<template>
    <div class="wizard-content">
        <div class="back-buttons">
            <button type="submit" class="btn btn-secondary text-nowrap m-1" @click="backClicked">
                <i class="fa-solid fa-backward" />
                Back to Local Database
            </button>
        </div>

        <div class="wizard-scroll-content">
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
                        <small class="text-muted">You'll probably need to type your X password. You might also need to
                            get
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

                <XLastImportOrBuildComponent :account-i-d="model.account.id" :show-button="false"
                    :show-no-data-warning="false" @set-state="emit('setState', $event)" />
            </div>
        </div>
        <div class="next-buttons">
            <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="!(
                model.account?.xAccount?.archiveTweets ||
                model.account?.xAccount?.archiveLikes ||
                model.account?.xAccount?.archiveDMs)" @click="importClicked">
                <i class="fa-solid fa-file-import" />
                I've Downloaded My Archive from X
            </button>
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
