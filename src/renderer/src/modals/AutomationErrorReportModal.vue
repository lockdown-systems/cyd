<script setup lang="ts">
import {
  onMounted,
  onUnmounted,
  ref,
  inject,
  Ref,
  getCurrentInstance,
} from "vue";
import {
  AutomationErrorTypeToMessage,
  AutomationErrorType,
} from "../automation_errors";
import { PlausibleEvents } from "../types";
import CydAPIClient from "../../../cyd-api-client";
import { PostAutomationErrorReportAPIRequest } from "../../../cyd-api-client";
import Modal from "bootstrap/js/dist/modal";
import { ErrorReport } from "../../../shared_types";

const emit = defineEmits(["hide"]);
const hide = () => {
  emit("hide");
};

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const automationErrorReportModal = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

const apiClient = inject("apiClient") as Ref<CydAPIClient>;

// Automation error fields
const includeSensitiveData = ref(false);
const errorReports = ref<ErrorReport[]>([]);

const errorReportType = (i: number) => {
  if (
    errorReports.value[i] &&
    AutomationErrorTypeToMessage[
      errorReports.value[i].errorReportType as AutomationErrorType
    ] !== null
  ) {
    return AutomationErrorTypeToMessage[
      errorReports.value[i].errorReportType as AutomationErrorType
    ];
  }
  return "Automation error";
};

const errorReportData = (i: number) => {
  if (errorReports.value[i].errorReportData) {
    console.log("errorReportData", errorReports.value[i].errorReportData);
    return JSON.parse(errorReports.value[i].errorReportData);
  }
  return "";
};

const sensitiveContextData = (i: number) => {
  if (errorReports.value[i].sensitiveContextData) {
    return JSON.parse(errorReports.value[i].sensitiveContextData);
  }
  return "";
};

// User description

const userDescription = ref("");

const onUserDescriptionChange = (_event: Event) => {
  for (let i = 0; i < errorReports.value.length; i++) {
    if (errorReports.value[i]) {
      const errorReportData = JSON.parse(errorReports.value[i].errorReportData);
      errorReportData.userDescription = userDescription.value;
      errorReports.value[i].errorReportData = JSON.stringify(errorReportData);
    }
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
  if (errorReports.value.length == 0) {
    console.error("No details provided for automation error report");
    return;
  }
  const accountID = errorReports.value[0].accountID;

  // If this is a manual action, instead of retrying, we should just resume
  if (
    errorReports.value[0].errorReportType ==
    AutomationErrorType.X_manualBugReport
  ) {
    emitter.emit(`automation-error-${accountID}-resume`);
    return;
  }

  if (
    await window.electron.showQuestion(
      "Do you want to try this step again, or cancel and go back to the dashboard?",
      "Retry",
      "Cancel",
    )
  ) {
    console.log("emitting:", `automation-error-${accountID}-retry`);
    emitter.emit(`automation-error-${accountID}-retry`);
  } else {
    console.log("emitting:", `automation-error-${accountID}-cancel`);
    emitter.emit(`automation-error-${accountID}-cancel`);
  }
};

const submitReport = async () => {
  if (errorReports.value.length == 0) {
    await window.electron.trackEvent(
      PlausibleEvents.AUTOMATION_ERROR_REPORT_ERROR,
      navigator.userAgent,
    );

    await window.electron.showError(
      "Well this is awkward. I don't seem to have details about your error report. This shouldn't happen.",
    );
    hide();
    await shouldRetry();
    return;
  }

  isSubmitting.value = true;

  // Get the account ID
  const accountID = errorReports.value[0].accountID;

  // Are we logged in?
  const authenticated = await apiClient.value.ping();

  for (let i = 0; i < errorReports.value.length; i++) {
    submittingIndex.value++;

    // Build the data object
    let data: PostAutomationErrorReportAPIRequest = {
      app_version: errorReports.value[i].appVersion,
      client_platform: errorReports.value[i].clientPlatform,
      account_type: errorReports.value[i].accountType,
      error_report_type: errorReports.value[i].errorReportType,
      error_report_data: JSON.parse(errorReports.value[i].errorReportData),
    };
    if (includeSensitiveData.value) {
      data = {
        ...data,
        account_username: errorReports.value[i].accountUsername,
        screenshot_data_uri: errorReports.value[i].screenshotDataURI,
        sensitive_context_data: JSON.parse(
          errorReports.value[i].sensitiveContextData,
        ),
      };
    }

    // Post the report
    const postAutomationErrorReportResp =
      await apiClient.value.postAutomationErrorReport(data, authenticated);
    if (
      postAutomationErrorReportResp !== true &&
      postAutomationErrorReportResp !== false &&
      postAutomationErrorReportResp.error
    ) {
      await window.electron.trackEvent(
        PlausibleEvents.AUTOMATION_ERROR_REPORT_ERROR,
        navigator.userAgent,
      );

      console.error(
        "Error posting automation error report:",
        postAutomationErrorReportResp.message,
      );
      await window.electron.showError(
        "Well this is awkward. There's an error submitting your automation error report.",
      );
    } else {
      await window.electron.trackEvent(
        PlausibleEvents.AUTOMATION_ERROR_REPORT_SUBMITTED,
        navigator.userAgent,
      );

      await window.electron.database.updateErrorReportSubmitted(
        errorReports.value[i].id,
      );
    }
  }

  // Dismiss any error reports that failed
  await window.electron.database.dismissNewErrorReports(accountID);

  hide();
  await shouldRetry();
};

const doNotSubmitReport = async () => {
  await window.electron.trackEvent(
    PlausibleEvents.AUTOMATION_ERROR_REPORT_NOT_SUBMITTED,
    navigator.userAgent,
  );

  // Dismiss the error reports
  const accountID = errorReports.value[0].accountID;
  await window.electron.database.dismissNewErrorReports(accountID);

  console.log("Skipping submission of automation error report");
  hide();
  await shouldRetry();
};

const isSubmitting = ref(false);
const submittingIndex = ref(0);

onMounted(async () => {
  const modalElement = automationErrorReportModal.value;
  if (modalElement) {
    modalInstance = new Modal(modalElement);
    modalInstance.show();

    // The 'hidden.bs.modal' event is triggered when when the user clicks outside the modal
    modalElement.addEventListener("hidden.bs.modal", () => {
      hide();
    });
  }

  isSubmitting.value = false;
  submittingIndex.value = 0;

  // Load the errors
  const accountIDString = localStorage.getItem("automationErrorAccountID");
  if (accountIDString == null) {
    console.error("No account ID provided for automation error report");
    return;
  }
  const accountID = parseInt(accountIDString);
  errorReports.value =
    await window.electron.database.getNewErrorReports(accountID);

  // Get default for includeSensitiveDataInAutomationErrorReports
  const includeSensitiveDataInAutomationErrorReports =
    await window.electron.database.getConfig(
      "includeSensitiveDataInAutomationErrorReports",
    );
  if (includeSensitiveDataInAutomationErrorReports == null) {
    // Default to true
    await window.electron.database.setConfig(
      "includeSensitiveDataInAutomationErrorReports",
      "true",
    );
    includeSensitiveData.value = true;
  } else {
    includeSensitiveData.value =
      includeSensitiveDataInAutomationErrorReports == "true";
  }
});

onUnmounted(() => {
  if (automationErrorReportModal.value && modalInstance) {
    automationErrorReportModal.value.removeEventListener(
      "hidden.bs.modal",
      hide,
    );
  }
});
</script>

<template>
  <div
    id="automationErrorReportModal"
    ref="automationErrorReportModal"
    class="modal fade"
    role="dialog"
    aria-labelledby="automationErrorReportModalLabel"
    aria-hidden="true"
  >
    <div
      class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
      role="document"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h4 class="modal-title">Submit an error report</h4>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
            @click="doNotSubmitReport"
          />
        </div>
        <div class="modal-body">
          <div class="d-flex flex-column">
            <div>
              <h5 v-if="errorReports.length == 1" class="mb-3">
                {{ errorReportType(0) }}
              </h5>
              <h5 v-else>
                {{ errorReports.length.toLocaleString() }} errors occured
              </h5>
              <div class="mb-3">
                <textarea
                  v-model="userDescription"
                  class="form-control w-100"
                  placeholder="Describe what happened (optional)"
                  aria-label="Describe what happened"
                  @input="onUserDescriptionChange"
                />
              </div>
              <div class="mb-3 form-check">
                <input
                  id="includeSensitiveData"
                  v-model="includeSensitiveData"
                  type="checkbox"
                  class="form-check-input"
                />
                <label class="form-check-label" for="includeSensitiveData">
                  <strong>Send extra details.</strong> This includes your
                  username, a screenshot of the embedded browser, and other data
                  that could help debug this problem.
                </label>
              </div>
              <p>
                The more info you provide, the easier it will be for us to fix.
              </p>
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
                <div v-if="showDetails">
                  <template
                    v-for="(errorReport, i) in errorReports"
                    :key="errorReport.id"
                  >
                    <div
                      v-if="errorReports.length > 1"
                      class="text-center fw-bold"
                    >
                      Error {{ i + 1 }} of {{ errorReports.length }}
                    </div>
                    <ul class="details">
                      <li>
                        <label>Error type:</label>
                        <span>{{ errorReportType(i) }}</span>
                      </li>
                      <li>
                        <label>App version:</label>
                        <span>
                          Cyd {{ errorReport.appVersion }} for
                          {{ errorReport.clientPlatform }}
                        </span>
                      </li>
                      <li>
                        <label>Account type:</label>
                        <span>{{ errorReport.accountType }}</span>
                      </li>
                      <li v-if="includeSensitiveData && errorReport !== null">
                        <label>Username:</label>
                        <span>{{ errorReport.accountUsername }}</span>
                      </li>
                      <li v-if="errorReportData(i) != ''">
                        <label>Details:</label>
                        <pre>{{ errorReportData(i) }}</pre>
                      </li>
                      <li
                        v-if="
                          includeSensitiveData &&
                          sensitiveContextData(i) != '' &&
                          sensitiveContextData(i) != '{}'
                        "
                      >
                        <label>Context:</label>
                        <pre>{{ sensitiveContextData(i) }}</pre>
                      </li>
                      <li
                        v-if="
                          includeSensitiveData &&
                          errorReport.screenshotDataURI != ''
                        "
                      >
                        <div class="screenshot text-center">
                          <img
                            :src="errorReport.screenshotDataURI"
                            alt="Screenshot of the embedded browser"
                          />
                        </div>
                      </li>
                    </ul>
                  </template>
                </div>
                <div v-else class="error-avatar text-center">
                  <img
                    src="/assets/cyd-omgkevin.svg"
                    class="mb-3"
                    alt="Cyd Error Message"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="d-flex justify-content-between w-100">
            <button
              type="button"
              class="btn btn-outline-danger"
              :disabled="isSubmitting"
              @click="doNotSubmitReport"
            >
              <i class="fa-solid fa-thumbs-down" />
              Don't Submit Report
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isSubmitting"
              @click="submitReport"
            >
              <i class="fa-solid fa-thumbs-up" />
              <template v-if="isSubmitting">
                Submitting {{ submittingIndex }}...
              </template>
              <template v-else> Submit Report </template>
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
  margin: 2rem;
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
