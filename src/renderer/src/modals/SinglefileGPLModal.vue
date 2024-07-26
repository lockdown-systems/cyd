<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

import { acceptSinglefileGPLAccepted } from '../helpers';

const emit = defineEmits(['hide']);
const hide = () => {
    emit('hide');
};

const singlefileGPLModal = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

const extractingChromium = ref(false);

const readLicenseClicked = () => {
    window.electron.openURL('https://github.com/gildas-lormeau/single-file-cli/blob/master/LICENSE');
};

const accessSourceCodeClicked = () => {
    window.electron.openURL('https://github.com/gildas-lormeau/single-file-cli');
};

const formSubmitted = async () => {
    if (!await window.electron.archive.isChromiumExtracted()) {
        extractingChromium.value = true;
        if (await window.electron.archive.extractChromium()) {
            extractingChromium.value = false;
        } else {
            window.electron.showError('Failed to extract Chromium');
        }
    }

    await acceptSinglefileGPLAccepted();
    hide();
};

onMounted(async () => {
    const modalElement = singlefileGPLModal.value;
    if (modalElement) {
        modalInstance = new Modal(modalElement);
        modalInstance.show();

        // The 'hidden.bs.modal' event is triggered when when the user clicks outside the modal
        modalElement.addEventListener('hidden.bs.modal', () => {
            hide();
        });
    }
});

onUnmounted(() => {
    if (singlefileGPLModal.value && modalInstance) {
        singlefileGPLModal.value.removeEventListener('hidden.bs.modal', hide);
    }
});
</script>

<template>
    <div id="singlefileGPLModal" ref="singlefileGPLModal" class="modal fade" role="dialog"
        aria-labelledby="singlefileGPLModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-xl modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title">
                        <template v-if="extractingChromium">
                            Extracting Chromium...
                        </template>
                        <template v-else>
                            SingleFile CLI is Open Source
                        </template>
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" @click="hide" />
                </div>
                <div class="modal-body">
                    <template v-if="extractingChromium">
                        <p>
                            Semiphemeral is extracting Chromium. This takes a few seconds...
                        </p>
                    </template>
                    <template v-else>
                        <p>
                            Semiphemeral uses <b>SingleFile CLI</b>, developed by Gildas Lormeau, to archive your data.
                            SingleFile CLI is <b>open source software</b> that can save web pages as a single HTML file.
                            It's licensed under the <b>Affero General Public License v3.0</b>.
                        </p>

                        <div class="d-flex flex-column p-3 mb-3">
                            <div class="d-flex align-items-center mb-2">
                                <div class="icon d-flex justify-content-center">
                                    <i class="fa-regular fa-file" />
                                </div>
                                <a href="#" class="flex-grow-1" @click="readLicenseClicked">Read the license</a>
                            </div>
                            <div class="d-flex align-items-center">
                                <div class="icon d-flex justify-content-center">
                                    <i class="fa-solid fa-code" />
                                </div>
                                <a href="#" class="flex-grow-1" @click="accessSourceCodeClicked">Access the source
                                    code</a>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary" @click="formSubmitted">
                            Awesome!
                        </button>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.icon {
    width: 50px;
}
</style>