<script setup lang="ts">
import { ref, onMounted, onUnmounted, defineEmits } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

defineProps({
    message: String,
    showErrorMessage: Boolean
});

const emit = defineEmits(['update:showErrorMessage']);

const hideError = () => {
    emit('update:showErrorMessage', false);
};

const errorModal = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

onMounted(() => {
    const modalElement = errorModal.value;
    if (modalElement) {
        modalInstance = new Modal(modalElement);
        modalInstance.show();

        // The 'hidden.bs.modal' event is triggered when when the user clicks outside the modal
        modalElement.addEventListener('hidden.bs.modal', () => {
            hideError();
        });
    }
});

onUnmounted(() => {
    if (errorModal.value && modalInstance) {
        errorModal.value.removeEventListener('hidden.bs.modal', hideError);
    }
});
</script>

<template>
    <div class="modal fade" id="errorModal" tabindex="-1" role="dialog" aria-labelledby="errorModalLabel"
        aria-hidden="true" ref="errorModal">
        <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Error</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"
                        @click="hideError"></button>
                </div>
                <div class="modal-body">
                    <p>{{ message }}</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"
                        @click="hideError">Close</button>
                </div>
            </div>
        </div>
    </div>
</template>
