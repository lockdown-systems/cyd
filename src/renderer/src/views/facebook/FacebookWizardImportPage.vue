<script setup lang="ts">
import {
    FacebookViewModel,
    State
} from '../../view_models/FacebookViewModel'

import FacebookLastImportOrBuildComponent from './FacebookLastImportOrBuildComponent.vue';
import { openURL } from '../../util';

// Props
defineProps<{
    model: FacebookViewModel;
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
                Import your Facebook archive
            </h2>
            <p class="text-muted">
                Before you can import your Facebook archive, you need to download it by following these steps:
            </p>
            <ul class="fb-archive-steps">
                <li>
                    <strong>Visit <a href="#" @click="openURL('https://accountscenter.facebook.com/info_and_permissions/dyi')">
                        https://accountscenter.facebook.com/info_and_permissions/dyi</a>.</strong><br>
                    <small class="text-muted">You might need to sign in to Facebook first.</small>
                </li>
                <li>
                    <strong>Prove your identity.</strong><br>
                    <small class="text-muted">You'll probably need to type your Facebook password. You might also need to get
                        a verification code sent to your email, or do other things to verify your identity.</small>
                </li>
                <li>
                    <strong>Click the "Download or transfer information" button.</strong>
                </li>
                <li>
                    <strong>Be patient.</strong><br>
                    <small class="text-muted">After requesting your archive, you'll need to wait <strong>at least a
                            day</strong>, and maybe longer. Sorry!</small>
                </li>
                <li>
                    <strong>When it's ready, download the ZIP file from Facebook.</strong><br>
                    <small class="text-muted">After you've followed these steps and you have your archive ZIP file,
                        click the button below.</small>
                </li>
            </ul>

            <div class="buttons mb-4">
                <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="!(
                    model.account?.facebookAccount?.saveMyData)" @click="importClicked">
                    <i class="fa-solid fa-file-import" />
                    I've Downloaded My Archive from Facebook
                </button>

                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Import or Build Database
                </button>
            </div>

            <FacebookLastImportOrBuildComponent :account-i-d="model.account.id" :button-text="'Go to Delete Options'"
                :button-text-no-data="'Skip to Delete Options'" :button-state="State.WizardDeleteOptions"
                @set-state="emit('setState', $event)" />
        </div>
    </div>
</template>

<style scoped>
ul.fb-archive-steps {
    list-style-type: none;
    padding: 0 1em;
}

ul.fb-archive-steps li {
    margin-bottom: 1em;
}
</style>