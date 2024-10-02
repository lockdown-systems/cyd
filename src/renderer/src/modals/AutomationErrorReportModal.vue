<script setup lang="ts">
import { onMounted, onUnmounted, ref, inject, Ref, getCurrentInstance } from 'vue';
import { AutomationErrorTypeToMessage, AutomationErrorDetails } from '../automation_errors';
import SemiphemeralAPIClient from '../semiphemeral-api-client';
import Modal from 'bootstrap/js/dist/modal';

const emit = defineEmits(['hide']);
const hide = () => {
    emit('hide');
};

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const automationErrorReportModal = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

const _apiClient = inject('apiClient') as Ref<SemiphemeralAPIClient>;

// Automation error fields
const details = ref<AutomationErrorDetails | null>(null);

emitter?.on('set-automation-error-details', (newDetails: AutomationErrorDetails) => {
    details.value = newDetails;
});

onMounted(async () => {
    const modalElement = automationErrorReportModal.value;
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
    if (automationErrorReportModal.value && modalInstance) {
        automationErrorReportModal.value.removeEventListener('hidden.bs.modal', hide);
    }
});
</script>

<template>
    <div id="automationErrorReportModal" ref="automationErrorReportModal" class="modal fade" role="dialog"
        aria-labelledby="automationErrorReportModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title">
                        {{ automationErrorType ? AutomationErrorTypeToMessage[automationErrorType] : 'Automation error'
                        }}
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" @click="hide" />
                </div>
                <div class="modal-body">
                    <div class="d-flex flex-column align-items-center">
                        <p>
                            Uh oh, something went wrong! The more info you provide, the easier it will be for us to fix.
                        </p>
                        <div v-if="details?.screenshotDataURL != ''" class="screenshot">
                            <img :src="details?.screenshotDataURL" alt="Screenshot">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped></style>