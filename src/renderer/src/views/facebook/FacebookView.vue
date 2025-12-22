<script setup lang="ts">
import { ref, onMounted, onUnmounted, getCurrentInstance, nextTick, computed } from "vue";
import type { WebviewTag } from "electron";
import type { Account } from "../../../../shared_types";
import PlatformView from "../PlatformView.vue";
import FacebookProgressComponent from "./components/FacebookProgressComponent.vue";
import { usePlatformView } from "../../composables/usePlatformView";
import { getPlatformConfig } from "../../config/platforms";
import { FacebookViewModel } from "../../view_models/FacebookViewModel";
import type { FacebookProgress } from "../../view_models/FacebookViewModel/types";
import { PlatformStates } from "../../types/PlatformStates";
import { AutomationErrorType } from "../../automation_errors";

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits(["onRefreshClicked", "onRemoveClicked"]);

const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;
const model = ref(new FacebookViewModel(props.account, emitter));
const platformViewRef = ref<InstanceType<typeof PlatformView> | null>(null);

const {
  config,
  currentState,
  progress,
  currentJobs,
  isPaused,
  clickingEnabled,
  userAuthenticated,
  userPremium,
  accountHeaderProps,
  speechBubbleProps,
  automationNoticeProps,
  webviewProps,
  setupAuthListeners,
  setupPlatformEventHandlers,
  createAutomationHandlers,
  startStateLoop,
  cleanup: platformCleanup,
  setupProviders,
  initializePlatformView,
  canStateLoopRun,
  setState,
} = usePlatformView(props.account, model, getPlatformConfig("Facebook")!);

const automationHandlers = createAutomationHandlers(() =>
  emit("onRefreshClicked"),
);

const onReportBug = async () => {
  console.log("Report bug clicked");
  model.value.pause();
  await model.value.error(
    AutomationErrorType.facebook_manualBugReport,
    {
      message: "User is manually reporting a bug",
      state: model.value.saveState(),
    },
    {
      currentURL: model.value.webview?.getURL(),
    },
  );
};

const typedProgress = computed(() => progress.value as FacebookProgress | null);

const startJobs = async () => {
  if (model.value.account.facebookAccount == null) {
    console.error("startJobs", "Account is null");
    return;
  }

  console.log("Starting Facebook jobs");

  // Refresh the account from the database to get latest settings
  const freshAccount = await window.electron.database.getAccount(
    model.value.account.id,
  );
  if (freshAccount) {
    model.value.account = freshAccount;
  }

  await model.value.defineJobs();
  model.value.state = PlatformStates.RunJobs;
  await startStateLoop();
};

onMounted(async () => {
  setupAuthListeners();
  setupProviders();

  await nextTick();

  const webview = platformViewRef.value?.webviewComponent as
    | WebviewTag
    | undefined;
  if (webview) {
    await initializePlatformView(webview);
    await startStateLoop();
  }

  setupPlatformEventHandlers(automationHandlers);
});

onUnmounted(async () => {
  canStateLoopRun.value = false;
  await platformCleanup();
  await model.value.cleanup();
});
</script>

<template>
  <PlatformView
    ref="platformViewRef"
    :account="account"
    :config="config"
    :model="model"
    :current-state="currentState"
    :progress="progress"
    :current-jobs="currentJobs"
    :is-paused="isPaused"
    :clicking-enabled="clickingEnabled"
    :user-authenticated="userAuthenticated"
    :user-premium="userPremium"
    :account-header-props="accountHeaderProps"
    :speech-bubble-props="speechBubbleProps"
    :automation-notice-props="automationNoticeProps"
    :webview-props="webviewProps"
    @on-refresh-clicked="emit('onRefreshClicked')"
    @on-remove-clicked="emit('onRemoveClicked')"
    @set-state="setState($event)"
    @start-jobs="startJobs"
    @on-pause="model.pause()"
    @on-resume="model.resume()"
    @on-cancel="emit('onRefreshClicked')"
    @on-report-bug="onReportBug"
    @on-clicking-enabled="clickingEnabled = true"
    @on-clicking-disabled="clickingEnabled = false"
  >
    <!-- Facebook-specific progress extra -->
    <template #progress-extra>
      <FacebookProgressComponent v-if="typedProgress" :progress="typedProgress" />
    </template>
  </PlatformView>
</template>
