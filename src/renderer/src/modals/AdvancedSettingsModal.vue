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
    const newDataPath = await window.electron.showOpenDialog(true, false, undefined);
    if (newDataPath) {
        dataPath.value = newDataPath;
        await window.electron.database.setConfig('dataPath', newDataPath);
    }
};

const deleteAllSettingsAndRestart = async () => {
    if (await window.electron.showQuestion("Are you sure you want to delete all settings and restart the app?", "Yes, delete it all!", "Cancel")) {
        await window.electron.deleteSettingsAndRestart();
    }
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
                        Advanced
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" @click="hide" />
                </div>
                <div class="modal-body">
                    <div class="mb-4">
                        <h5>Data Folder</h5>
                        <div class="input-group">
                            <input v-model="dataPath" type="text" class="form-control" readonly>
                            <button class="btn btn-secondary" @click="browseClicked">
                                Browse
                            </button>
                        </div>
                    </div>

                    <div class="danger-zone mt-5">
                        <p class="mb-1">
                            <button class="btn btn-sm btn-outline-danger" @click="deleteAllSettingsAndRestart">
                                Reset Cyd
                            </button>
                        </p>
                        <p class="text-muted">
                            Delete all settings and restart the app
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped></style>