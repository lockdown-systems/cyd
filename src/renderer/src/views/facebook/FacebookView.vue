<script setup lang="ts">
import { ref, onMounted, onUnmounted, getCurrentInstance, nextTick } from "vue";
import type { WebviewTag } from "electron";
import type { Account } from "../../../../shared_types";
import PlatformView from "../PlatformView.vue";
import { usePlatformView } from "../../composables/usePlatformView";
import { getPlatformConfig } from "../../config/platforms";
import { FacebookViewModel } from "../../view_models/FacebookViewModel";

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
  />
</template>
