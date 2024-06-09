<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';

defineProps({
    message: String
});

const emit = defineEmits(['hide']);
const hide = () => {
    emit('hide');
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
            hide();
        });
    }
});

onUnmounted(() => {
    if (errorModal.value && modalInstance) {
        errorModal.value.removeEventListener('hidden.bs.modal', hide);
    }
});
</script>

<template>
    <div class="modal fade" id="errorModal" ref="errorModal" tabindex="-1" role="dialog"
        aria-labelledby="errorModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Error</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"
                        @click="hide"></button>
                </div>
                <div class="modal-body">
                    <p>{{ message }}</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" @click="hide">Close</button>
                </div>
            </div>
        </div>
    </div>
</template>
