<script setup lang="ts">
import { ref, onMounted, onUnmounted, getCurrentInstance } from "vue";
import type { Account } from "../../../../shared_types";
import PlatformView from "../PlatformView.vue";
import { usePlatformView } from "../../composables/usePlatformView";
import { getPlatformConfig } from "../../config/platforms";
import { BlueskyViewModel } from "../../view_models/BlueskyViewModel";

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits(["onRefreshClicked", "onRemoveClicked"]);

const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;
const model = ref(new BlueskyViewModel(props.account, emitter));

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
  setupAuthListeners,
  setupPlatformEventHandlers,
  createAutomationHandlers,
  startStateLoop,
  platformCleanup,
  setupProviders,
  initializePlatformView,
  canStateLoopRun,
  setState,
} = usePlatformView(props.account, model, getPlatformConfig("Bluesky")!);

const automationHandlers = createAutomationHandlers(() =>
  emit("onRefreshClicked"),
);

onMounted(async () => {
  setupAuthListeners();
  setupProviders();

  // Bluesky's platform config drives no browser, so the composable starts the
  // view model with no webview: the account's local storage is all the
  // dashboard needs, and it renders with no connection and no saved data.
  await initializePlatformView();
  await startStateLoop();

  setupPlatformEventHandlers(automationHandlers);
});

onUnmounted(async () => {
  canStateLoopRun.value = false;
  await platformCleanup();
});
</script>

<template>
  <PlatformView
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
    @on-refresh-clicked="emit('onRefreshClicked')"
    @on-remove-clicked="emit('onRemoveClicked')"
    @set-state="setState($event)"
    @on-pause="model.pause()"
    @on-resume="model.resume()"
    @on-cancel="emit('onRefreshClicked')"
    @on-clicking-enabled="clickingEnabled = true"
    @on-clicking-disabled="clickingEnabled = false"
  />
</template>
