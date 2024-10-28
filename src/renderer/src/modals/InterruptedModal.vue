<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

import { openPreventSleepURL } from '../util';

const emit = defineEmits(['hide']);
const hide = () => {
    emit('hide');
};

const interruptedModal = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

const preventSleepLearnMore = async () => {
    await openPreventSleepURL();
};

onMounted(async () => {
    const modalElement = interruptedModal.value;
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
    if (interruptedModal.value && modalInstance) {
        interruptedModal.value.removeEventListener('hidden.bs.modal', hide);
    }
});
</script>

<template>
    <div id="signInModal" ref="interruptedModal" class="modal fade" role="dialog"
        aria-labelledby="interruptedModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title">
                        Semiphemeral was interrupted
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" @click="hide" />
                </div>
                <div class="modal-body">
                    <p>This probably happened because your computer went to sleep.</p>
                    <p><a href="#" @click="preventSleepLearnMore">Follow these instructions</a> to temporarily prevent
                        your computer from sleeping.</p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped></style>