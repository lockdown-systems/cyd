<script setup lang="ts">
/**
 * PlatformView.vue - Generic Platform View Component
 *
 * This is a generic, reusable component that works for any platform (X, Facebook, etc.).
 * It uses the 3-piece architecture:
 * 1. usePlatformView composable - handles shared logic
 * 2. PlatformConfig - provides platform-specific configuration
 * 3. PlatformView (this component) - renders the generic template
 *
 * Platform-specific views (XView, FacebookView) are thin wrappers that:
 * - Instantiate the platform ViewModel
 * - Handle platform-specific state and events
 * - Render this component with platform config
 *
 * HOW TO ADD A NEW PLATFORM:
 * 1. Create a PlatformConfig in src/renderer/src/config/platforms/
 * 2. Create a thin wrapper view that uses this component
 * 3. Create platform-specific components (wizards, job status, etc.)
 */

import { unref, computed, type Ref } from "vue";
import type { Account } from "../../../shared_types";
import type { PlatformConfig } from "../types/PlatformConfig";
import type { BasePlatformViewModel } from "../types/PlatformView";

import AccountHeader from "./shared_components/AccountHeader.vue";
import SpeechBubble from "./shared_components/SpeechBubble.vue";
import AutomationNotice from "./shared_components/AutomationNotice.vue";
import LoadingComponent from "./shared_components/LoadingComponent.vue";
import { openURL } from "../util";
import { PlatformStates } from "../types/PlatformStates";

const props = defineProps<{
  account: Account;
  config: PlatformConfig;
  model: Ref<BasePlatformViewModel>;
  // Composable outputs
  currentState: Ref<string>;
  progress: Ref<unknown>;
  currentJobs: Ref<unknown[]>;
  isPaused: Ref<boolean>;
  clickingEnabled: Ref<boolean>;
  userAuthenticated: Ref<boolean>;
  userPremium: Ref<boolean>;
  speechBubbleComponent: Ref<InstanceType<typeof SpeechBubble> | null>;
  webviewComponent: Ref<HTMLElement | null>;
  accountHeaderProps: {
    account: Account;
    showRefreshButton: boolean;
  };
  speechBubbleProps: {
    message: string;
  };
  automationNoticeProps: {
    showBrowser: boolean;
    showAutomationNotice: boolean;
  };
  webviewProps: Record<string, unknown>;
}>();

const emit = defineEmits<{
  // Core navigation events
  onRefreshClicked: [];
  onRemoveClicked: [];

  // Platform-specific customization events
  setState: [state: string];
  updateAccount: [];
  startJobs: [];
  startJobsJustSave: [];
  finishedRunAgainClicked: [];
  updateUserPremium: [];

  // Archive only (conditional on feature flag)
  archiveOnlyClicked: [];

  // Job control events
  onPause: [];
  onResume: [];
  onCancel: [];
  onReportBug: [];
  onClickingEnabled: [];
  onClickingDisabled: [];

  // Debug events
  setDebugAutopauseEndOfStep: [value: boolean];
}>();

// Computed values for accessing refs in template
const modelState = computed(() => props.model.value.state);
const modelShowBrowser = computed(() => props.model.value.showBrowser);
const currentJobsLength = computed(() => props.currentJobs.value.length);
</script>

<template>
  <div :class="['wrapper', `account-${account.id}`, 'd-flex', 'flex-column']">
    <AccountHeader
      v-bind="accountHeaderProps"
      @on-refresh-clicked="emit('onRefreshClicked')"
      @on-remove-clicked="emit('onRemoveClicked')"
    />

    <template v-if="modelState == PlatformStates.WizardStart">
      <LoadingComponent />
    </template>

    <template v-if="modelState != PlatformStates.WizardStart">
      <div class="d-flex ms-2">
        <div class="d-flex flex-column flex-grow-1">
          <!-- Speech bubble -->
          <SpeechBubble
            ref="speechBubbleComponent"
            v-bind="speechBubbleProps"
            class="mb-2"
            :class="{ 'w-100': currentJobsLength === 0 }"
          />

          <!-- Progress component (platform-specific) -->
          <div v-if="progress && modelState == PlatformStates.RunJobs">
            <component
              :is="config.components.progressComponent"
              :progress="progress"
              :account-i-d="account.id"
            >
              <!-- Slot for platform-specific progress extras (e.g., rate limit info) -->
              <slot name="progress-extra" :progress="progress" />
            </component>
          </div>
        </div>

        <div class="d-flex align-items-center">
          <!-- Job status component (platform-specific) -->
          <component
            :is="config.components.jobStatus"
            v-if="currentJobsLength > 0 && modelState == PlatformStates.RunJobs"
            :jobs="currentJobs"
            :is-paused="isPaused"
            :clicking-enabled="clickingEnabled"
            class="job-status-component"
            @on-pause="emit('onPause')"
            @on-resume="emit('onResume')"
            @on-cancel="emit('onCancel')"
            @on-report-bug="emit('onReportBug')"
            @on-clicking-enabled="emit('onClickingEnabled')"
            @on-clicking-disabled="emit('onClickingDisabled')"
          >
            <!-- Slot for platform-specific job status extras -->
            <slot name="job-status-extra" :jobs="currentJobs" />
          </component>
        </div>
      </div>

      <!-- U2F security key notice (conditional on feature flag) -->
      <p
        v-if="
          config.features.hasU2FSupport && modelState == PlatformStates.Login
        "
        class="u2f-info text-center text-muted small ms-2"
      >
        <i class="fa-solid fa-circle-info me-2" />
        If you use a U2F security key (like a Yubikey) for 2FA, press it when
        you see a white screen.
        <a
          v-if="config.urls.u2fDocs"
          href="#"
          @click="openURL(config.urls.u2fDocs)"
          >Read more</a
        >.
      </p>

      <!-- Archive only option (conditional on feature flag) -->
      <div
        v-if="
          config.features.hasArchiveOnly && modelState == PlatformStates.Login
        "
        class="text-center ms-2 mt-2 mb-4"
      >
        <slot name="archive-only-button">
          <button class="btn btn-secondary" @click="emit('archiveOnlyClicked')">
            Import Archive Only (for deleted accounts with an archive)
          </button>
        </slot>
      </div>

      <AutomationNotice v-bind="automationNoticeProps" />
    </template>

    <!-- Webview -->
    <webview ref="webviewComponent" v-bind="webviewProps" />

    <template v-if="modelState != PlatformStates.WizardStart">
      <!-- RunJobs display content (platform-specific) -->
      <div
        v-if="config.components.displayContent"
        :class="{
          hidden: modelShowBrowser || modelState != PlatformStates.RunJobs,
          'run-jobs-state': true,
          'ms-2': true,
        }"
      >
        <div class="run-jobs-state-container d-flex">
          <div class="run-jobs-state-content flex-grow-1">
            <component
              :is="config.components.displayContent"
              :model="unref(model)"
            >
              <!-- Slot for additional display content props -->
              <slot name="display-content-extra" :model="model" />
            </component>
          </div>
        </div>
      </div>

      <!-- Wizard -->
      <div
        :class="{
          hidden: modelShowBrowser || modelState == PlatformStates.RunJobs,
          wizard: true,
          'ms-2': true,
        }"
      >
        <div class="wizard-container d-flex">
          <div class="wizard-content flex-grow-1">
            <!-- Dynamic wizard component rendering based on platform configuration -->
            <component
              :is="config.components.wizardPages[modelState]"
              v-if="config.components.wizardPages[modelState]"
              :model="unref(model)"
              :user-authenticated="userAuthenticated"
              :user-premium="userPremium"
              @set-state="emit('setState', $event)"
              @update-account="emit('updateAccount')"
              @start-jobs="emit('startJobs')"
              @start-jobs-just-save="emit('startJobsJustSave')"
              @update-user-premium="emit('updateUserPremium')"
              @finished-run-again-clicked="emit('finishedRunAgainClicked')"
              @on-refresh-clicked="emit('onRefreshClicked')"
            >
              <!-- Slot for passing platform-specific props to wizard pages -->
              <slot
                name="wizard-page-extra"
                :model="model"
                :state="modelState"
              />
            </component>

            <!-- Slot for platform-specific wizard content (e.g., debug mode, tombstone) -->
            <slot name="wizard-content-extra" :model="model" />
          </div>

          <!-- Wizard sidebar (platform-specific) -->
          <component
            :is="config.components.wizardSidebar"
            v-if="config.components.wizardSidebar"
            :model="unref(model)"
            @set-state="emit('setState', $event)"
            @set-debug-autopause-end-of-step="
              emit('setDebugAutopauseEndOfStep', $event)
            "
          >
            <!-- Slot for sidebar customization -->
            <slot name="wizard-sidebar-extra" :model="model" />
          </component>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.job-status-component {
  width: 220px;
}
</style>
