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
const appVersion = ref('');
const clientPlatform = ref('');
const includeSensitiveData = ref(false);
const details = ref<AutomationErrorDetails | null>(null);

emitter?.on('set-automation-error-details', (newDetails: AutomationErrorDetails) => {
    details.value = newDetails;
});

const automationErrorType = () => {
    if (AutomationErrorTypeToMessage[details.value?.automationErrorType] !== null) {
        return AutomationErrorTypeToMessage[details.value?.automationErrorType];
    }
    return "Automation error";
};

const errorReportData = () => {
    if (details.value?.errorReportData) {
        return details.value.errorReportData;
    }
    return "";
};

const sensitiveContextData = () => {
    if (details.value?.sensitiveContextData) {
        return details.value.sensitiveContextData;
    }
    return "";
};

const showDetailsYesText = "Hide information included in report";
const showDetailsNoText = "Show information included in report";
const showDetailsLabel = ref(showDetailsNoText);
const showDetails = ref(false);

const toggleShowDetails = () => {
    showDetails.value = !showDetails.value;
    if (showDetails.value) {
        showDetailsLabel.value = showDetailsYesText;
    } else {
        showDetailsLabel.value = showDetailsNoText;
    }
};

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

    // Load the app version and client platform
    appVersion.value = await window.electron.getVersion();
    clientPlatform.value = await window.electron.getPlatform();

    // Get default for includeSensitiveDataInAutomationErrorReports
    const includeSensitiveDataInAutomationErrorReports = await window.electron.database.getConfig("includeSensitiveDataInAutomationErrorReports");
    if (includeSensitiveDataInAutomationErrorReports == null) {
        // Default to true
        await window.electron.database.setConfig("includeSensitiveDataInAutomationErrorReports", "true");
        includeSensitiveData.value = true;
    } else {
        includeSensitiveData.value = (includeSensitiveDataInAutomationErrorReports == "true");
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
                        Automation Error: {{ automationErrorType() }}
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" @click="hide" />
                </div>
                <div class="modal-body">
                    <div class="d-flex flex-column">
                        <form class="w-100" @submit.prevent>
                            <div class="mb-3 form-check">
                                <input id="includeSensitiveData" v-model="includeSensitiveData" type="checkbox"
                                    class="form-check-input">
                                <label class="form-check-label" for="includeSensitiveData">
                                    Include my username, a screenshot of the embedded browser, and other data that could
                                    help debug this problem. The more info you provide, the easier it will be for us to
                                    fix.
                                </label>
                            </div>
                            <div>
                                <p>
                                    <a href="#" class="toggle-details" @click="toggleShowDetails">
                                        <template v-if="showDetails">
                                            <i class="fa-solid fa-angle-down" />
                                        </template>
                                        <template v-else>
                                            <i class="fa-solid fa-angle-right" />
                                        </template>
                                        {{ showDetailsLabel }}
                                    </a>
                                </p>
                                <ul v-if="showDetails" class="details">
                                    <li>
                                        <label>App version:</label>
                                        <span>
                                            Semiphemeral {{ appVersion }} for {{
                                                clientPlatform }}
                                        </span>
                                    </li>
                                    <li>
                                        <label>Account type:</label>
                                        <span>{{ details?.accountType }}</span>
                                    </li>
                                    <li v-if="includeSensitiveData && details?.username != ''">
                                        <label>Username:</label>
                                        <span>{{ details?.username }}</span>
                                    </li>
                                    <li>
                                        <label>Error type:</label>
                                        <span>{{ automationErrorType() }}</span>
                                    </li>
                                    <li v-if="includeSensitiveData && errorReportData() != ''">
                                        <label>Details:</label>
                                        <pre>{{ errorReportData() }}</pre>
                                    </li>
                                    <li
                                        v-if="includeSensitiveData && sensitiveContextData() != '' && sensitiveContextData() != '{}'">
                                        <label>Context:</label>
                                        <pre>{{ sensitiveContextData() }}</pre>
                                    </li>
                                    <li v-if="includeSensitiveData && details && details.screenshotDataURL != ''">
                                        <div class="screenshot text-center">
                                            <img :src="details?.screenshotDataURL"
                                                alt="Screenshot of the embedded browser">
                                        </div>
                                    </li>
                                </ul>
                            </div>
                            <div class="d-flex justify-content-between mt-4">
                                <button type="button" class="btn btn-outline-danger">
                                    <i class="fa-solid fa-thumbs-down" />
                                    Don't Submit Report
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fa-solid fa-thumbs-up" />
                                    Submit Report
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.screenshot img {
    max-width: 80%;
    border: 3px solid #000;
}

.w-100 {
    width: 100% !important;
}

a.toggle-details {
    text-decoration: none;
}

ul.details {
    list-style-type: none;
    padding-left: 0;
    border: 1px solid #999;
    border-radius: 0.5rem;
    padding: 1.5rem;
}

ul.details li {
    margin-bottom: 0.5rem;
}

ul.details li label {
    font-weight: bold;
    margin-right: 0.5rem;
}

pre {
    font-size: 0.8rem;
    color: #666;
}
</style>