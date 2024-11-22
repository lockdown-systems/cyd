<script setup lang="ts">
import { onMounted, onUnmounted, ref, inject, Ref, getCurrentInstance } from 'vue';
import { AutomationErrorTypeToMessage, AutomationErrorDetails } from '../automation_errors';
import { PlausibleEvents } from "../types";
import CydAPIClient from '../../../cyd-api-client';
import { PostAutomationErrorReportAPIRequest } from '../../../cyd-api-client';
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

const apiClient = inject('apiClient') as Ref<CydAPIClient>;

// Automation error fields
const appVersion = ref('');
const clientPlatform = ref('');
const includeSensitiveData = ref(false);
const details = ref<AutomationErrorDetails | null>(null);

emitter?.on('set-automation-error-details', (newDetails: AutomationErrorDetails) => {
    details.value = newDetails;
});

const automationErrorType = () => {
    if (details.value && AutomationErrorTypeToMessage[details.value?.automationErrorType] !== null) {
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

// User description

const userDescription = ref('');

const onUserDescriptionChange = (_event: Event) => {
    if (details.value) {
        details.value.errorReportData.userDescription = userDescription.value;
    }
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

const shouldRetry = async () => {
    if (!details.value) {
        console.error("No details provided for automation error report");
        return;
    }

    if (await window.electron.showQuestion(
        "Do you want to try this step again, or cancel and go back to the dashboard?",
        "Retry",
        "Cancel"
    )) {
        emitter.emit(`automation-error-${details.value?.accountID}-retry`);
    } else {
        emitter.emit(`automation-error-${details.value?.accountID}-cancel`);
    }
};

const submitReport = async () => {
    if (!details.value) {
        await window.electron.trackEvent(PlausibleEvents.AUTOMATION_ERROR_REPORT_ERROR, navigator.userAgent);

        await window.electron.showError("Well this is awkward. I don't seem to have details about your error report. This shouldn't happen.")
        hide();
        await shouldRetry();
        return;
    }

    // Build the data object
    let data: PostAutomationErrorReportAPIRequest = {
        app_version: appVersion.value,
        client_platform: clientPlatform.value,
        account_type: details.value.accountType,
        error_report_type: details.value.automationErrorType,
        error_report_data: JSON.parse(JSON.stringify(details.value.errorReportData)),
    };
    if (includeSensitiveData.value) {
        data = {
            ...data,
            account_username: details.value.username,
            screenshot_data_uri: details.value.screenshotDataURL,
            sensitive_context_data: JSON.parse(JSON.stringify(details.value.sensitiveContextData)),
        }
    }

    // Are we logged in?
    const authenticated = await apiClient.value.ping();

    // Post the report
    const postAutomationErrorReportResp = await apiClient.value.postAutomationErrorReport(data, authenticated);
    if (postAutomationErrorReportResp !== true && postAutomationErrorReportResp !== false && postAutomationErrorReportResp.error) {
        await window.electron.trackEvent(PlausibleEvents.AUTOMATION_ERROR_REPORT_ERROR, navigator.userAgent);

        console.error("Error posting automation error report:", postAutomationErrorReportResp.message);
        await window.electron.showError("Well this is awkward. There's an error submitting your automation error report.")
    } else {
        await window.electron.trackEvent(PlausibleEvents.AUTOMATION_ERROR_REPORT_SUBMITTED, navigator.userAgent);
    }

    hide();
    await shouldRetry();
};

const doNotSubmitReport = async () => {
    await window.electron.trackEvent(PlausibleEvents.AUTOMATION_ERROR_REPORT_NOT_SUBMITTED, navigator.userAgent);

    console.log("Skipping submission of automation error report");
    hide();
    await shouldRetry();
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
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title">
                        Submit an error report
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"
                        @click="doNotSubmitReport" />
                </div>
                <div class="modal-body">
                    <div class="d-flex flex-column">
                        <div>
                            <h5 class="mb-3">
                                {{ automationErrorType() }}
                            </h5>
                            <div class="mb-3">
                                <textarea v-model="userDescription" class="form-control w-100"
                                    placeholder="Describe what happened (optional)" aria-label="Describe what happened"
                                    @input="onUserDescriptionChange" />
                            </div>
                            <div class="mb-3 form-check">
                                <input id="includeSensitiveData" v-model="includeSensitiveData" type="checkbox"
                                    class="form-check-input">
                                <label class="form-check-label" for="includeSensitiveData">
                                    <strong>Send extra details.</strong> This includes your username, a
                                    screenshot of the embedded browser, and other data that could help debug
                                    this problem.
                                </label>
                            </div>
                            <p>The more info you provide, the easier it will be for us to fix.</p>
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
                                            Cyd {{ appVersion }} for {{ clientPlatform }}
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
                                    <li v-if="errorReportData() != ''">
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
                                <div v-else class="error-avatar text-center">
                                    <img src="/assets/cyd-omgkevin.svg" class="mb-3" alt="Cyd Error Message">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="d-flex justify-content-between w-100">
                        <button type="button" class="btn btn-outline-danger" @click="doNotSubmitReport">
                            <i class="fa-solid fa-thumbs-down" />
                            Don't Submit Report
                        </button>
                        <button type="submit" class="btn btn-primary" @click="submitReport">
                            <i class="fa-solid fa-thumbs-up" />
                            Submit Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.error-avatar img {
    width: 180px;
    animation: spin-alternate 1.5s linear infinite;
    margin: 2rem;
}

@keyframes spin-alternate {
    0% {
        transform: rotate(0deg);
    }

    25% {
        transform: rotate(15deg);
    }

    50% {
        transform: rotate(0deg);
    }

    75% {
        transform: rotate(-15deg);
    }

    100% {
        transform: rotate(0deg);
    }
}

.screenshot img {
    max-width: 100%;
    border: 3px solid #000;
}

a.toggle-details {
    text-decoration: none;
}

ul.details {
    list-style-type: none;
    padding-left: 0;
    border: 1px solid #d0d0d0;
    border-radius: 0.5rem;
    padding: 1.5rem;
    background-color: #fafafa;
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

.w-100 {
    width: 100% !important;
}
</style>