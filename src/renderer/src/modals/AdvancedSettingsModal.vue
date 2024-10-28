<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

const emit = defineEmits(['hide']);
const hide = () => {
    emit('hide');
};

const advancedSettingsModal = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

const dataPath = ref('');

const browseClicked = async () => {
    await window.electron.showMessage("Not implemented yet");
};

const deleteAllSettingsAndRestart = async () => {
    await window.electron.showMessage("Not implemented yet");
};

onMounted(async () => {
    const dataPathConfig = await window.electron.database.getConfig('dataPath');
    if (dataPathConfig) {
        dataPath.value = dataPathConfig;
    }

    const modalElement = advancedSettingsModal.value;
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
    if (advancedSettingsModal.value && modalInstance) {
        advancedSettingsModal.value.removeEventListener('hidden.bs.modal', hide);
    }
});
</script>

<template>
    <div id="signInModal" ref="advancedSettingsModal" class="modal fade" role="dialog"
        aria-labelledby="advancedSettingsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title">
                        Advanced settings
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" @click="hide" />
                </div>
                <div class="modal-body">
                    <div class="mb-4">
                        <h5>Data Folder</h5>
                        <div class="input-group">
                            <input type="text" class="form-control" v-model="dataPath" readonly>
                            <button class="btn btn-secondary" @click="browseClicked">Browse</button>
                        </div>
                    </div>

                    <div class="danger-zone mt-5">
                        <h5 class="text-danger">Danger Zone</h5>
                        <button class="btn btn-danger" @click="deleteAllSettingsAndRestart">Delete all settings and
                            restart the app</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped></style>