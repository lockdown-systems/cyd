import {
  ref,
  watch,
  inject,
  getCurrentInstance,
  type Ref,
  computed,
} from "vue";
import type { WebviewTag } from "electron";
import CydAPIClient, { UserPremiumAPIResponse } from "../../../cyd-api-client";
import type { Account } from "../../../shared_types";
import type { DeviceInfo } from "../types";
import type { BasePlatformViewModel } from "../types/PlatformView";
import type { PlatformConfig } from "../types/PlatformConfig";
import { setAccountRunning } from "../util";

// Track registered providers to avoid duplicates
const registeredProviders = new Set<string>();

/**
 * Shared composable for platform views that handles common functionality
 * like authentication, state management, and progress tracking
 */
export function usePlatformView<
  T extends BasePlatformViewModel & {
    run: () => Promise<void>;
    init: (webview: WebviewTag) => Promise<void>;
    cleanup: () => void;
  },
>(account: Account, model: Ref<T>, config: PlatformConfig) {
  // Get dependencies
  const vueInstance = getCurrentInstance();
  const emitter = vueInstance?.appContext.config.globalProperties.emitter;
  const apiClient = inject("apiClient") as Ref<CydAPIClient>;
  const deviceInfo = inject("deviceInfo") as Ref<DeviceInfo | null>;

  // Shared reactive state
  const currentState = ref<string>("");
  const progress = ref<unknown | null>(null);
  const currentJobs = ref<unknown[]>([]);
  const isPaused = ref<boolean>(false);
  const canStateLoopRun = ref(true);
  const clickingEnabled = ref(false);

  // User authentication state
  const userAuthenticated = ref(false);
  const userPremium = ref(false);

  // Shared component references
  const speechBubbleComponent = ref(null);
  const webviewComponent = ref(null);

  // Track registered event handlers for cleanup
  const registeredHandlers = ref<
    Array<{
      event: string;
      handler: (...args: unknown[]) => void | Promise<void>;
    }>
  >([]);

  // Computed properties for shared template elements
  const accountHeaderProps = computed(() => ({
    account,
    showRefreshButton: true,
  }));

  const speechBubbleProps = computed(() => ({
    message: model.value.instructions || "",
  }));

  const automationNoticeProps = computed(() => ({
    showBrowser: model.value.showBrowser,
    showAutomationNotice: model.value.showAutomationNotice,
  }));

  const webviewProps = computed(() => ({
    src: "about:blank",
    partition: `persist:account-${account.id}`,
    class: [
      "webview",
      {
        hidden: !model.value.showBrowser,
        "webview-automation-border": model.value.showAutomationNotice,
        "webview-input-border": !model.value.showAutomationNotice,
        "webview-clickable": clickingEnabled.value,
      },
    ],
  }));

  // Watch model state changes
  watch(
    () => model.value.state,
    (newState) => {
      if (newState) {
        currentState.value = newState;
      }
    },
    { deep: true },
  );

  // Watch progress updates
  watch(
    () => model.value.progress,
    (newProgress) => {
      if (newProgress) progress.value = newProgress;
    },
    { deep: true },
  );

  // Watch jobs updates
  watch(
    () => model.value.jobs,
    (newJobs) => {
      if (newJobs) currentJobs.value = newJobs;
    },
    { deep: true },
  );

  // Watch pause state
  watch(
    () => model.value.isPaused,
    (newIsPaused) => {
      if (newIsPaused !== undefined) isPaused.value = newIsPaused;
    },
    { deep: true },
  );

  // Feature flag helpers
  const hasFeature = (feature: keyof typeof config.features) => {
    return config.features[feature];
  };

  const requiresPremium = () => {
    return config.features.hasPremiumGating;
  };

  // Shared methods
  const updateAccount = async () => {
    console.log("Updating account");
    await model.value.reloadAccount();
    emitter?.emit("account-updated");
  };
  const setState = async (state: string) => {
    console.log("Setting state", state);
    model.value.state = state;
    await startStateLoop();
  };

  const startStateLoop = async () => {
    console.log("State loop started");
    await setAccountRunning(account.id, true);

    while (canStateLoopRun.value) {
      // Run next state
      await model.value.run();

      // Break out of the state loop if the view model is in a display state
      if (model.value.state.endsWith("Display")) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await setAccountRunning(account.id, false);
    console.log("State loop ended");
  };

  const updateUserAuthenticated = async () => {
    userAuthenticated.value =
      (await apiClient.value.ping()) && deviceInfo.value?.valid ? true : false;
    console.log(
      "updateUserAuthenticated",
      "User authenticated",
      userAuthenticated.value,
    );
  };

  const updateUserPremium = async () => {
    if (!userAuthenticated.value) {
      return;
    }

    // Only check premium if this platform uses premium gating
    if (!config.features.hasPremiumGating) {
      userPremium.value = true; // Always considered premium if platform doesn't use gating
      return;
    }

    let userPremiumResp: UserPremiumAPIResponse;
    const resp = await apiClient.value.getUserPremium();
    if (resp && "error" in resp === false) {
      userPremiumResp = resp;
    } else {
      await window.electron.showMessage(
        "Failed to check if you have Premium access.",
        "Please try again later.",
      );
      return;
    }
    userPremium.value = userPremiumResp.premium_access;

    if (!userPremium.value) {
      console.log("User does not have Premium access");
      emitter?.emit(
        `${config.name.toLowerCase()}-premium-check-failed-${account.id}`,
      );
    }

    console.log("updateUserPremium", "User premium", userPremiumResp);
  };

  // Event listeners for authentication
  const setupAuthListeners = () => {
    const signedInHandler = async () => {
      console.log(`${config.name}View: User signed in`);
      await updateUserAuthenticated();
      await updateUserPremium();
    };

    const signedOutHandler = async () => {
      console.log(`${config.name}View: User signed out`);
      userAuthenticated.value = false;
      userPremium.value = false;
    };

    emitter?.on("signed-in", signedInHandler);
    emitter?.on("signed-out", signedOutHandler);

    registeredHandlers.value.push(
      { event: "signed-in", handler: signedInHandler },
      { event: "signed-out", handler: signedOutHandler },
    );
  };

  // Generic event handler setup for platform-specific events
  const setupPlatformEventHandlers = (
    handlers: Record<string, () => void | Promise<void>>,
  ) => {
    Object.entries(handlers).forEach(([event, handler]) => {
      const eventName = event.includes("${account.id}")
        ? event.replace("${account.id}", account.id.toString())
        : event;
      emitter?.on(eventName, handler);
      registeredHandlers.value.push({ event: eventName, handler });
    });
  };

  // Generic automation event handlers that can be shared
  const createAutomationHandlers = (
    onRefresh: () => void,
    onRetry?: () => void | Promise<void>,
  ) => {
    return {
      [`cancel-automation-${account.id}`]: () => {
        console.log("Cancelling automation");
        onRefresh();
      },
      [`automation-error-${account.id}-cancel`]: () => {
        console.log("Cancelling automation after error");
        onRefresh();
      },
      [`automation-error-${account.id}-resume`]: () => {
        console.log("Resuming after error");
        resume(); // Use composable's resume method
      },
      [`automation-error-${account.id}-retry`]: async () => {
        console.log("Retrying automation after error");
        if (onRetry) {
          await onRetry();
        } else {
          onRefresh();
        }
      },
    };
  };

  const cleanup = async () => {
    canStateLoopRun.value = false;
    await setAccountRunning(account.id, false);

    // Remove all registered event handlers
    registeredHandlers.value.forEach(({ event, handler }) => {
      emitter?.off(event, handler);
    });
    registeredHandlers.value = [];
  };

  // Platform model methods
  const pause = () => model.value.pause();
  const resume = () => model.value.resume();

  // Lifecycle management
  const initializePlatformView = async (webview: WebviewTag) => {
    console.log("Initializing platform view");
    await model.value.init(webview);
  };

  const setupProviders = () => {
    // Setup shared provide statements that components can inject
    const vueInject = vueInstance?.appContext.app.provide;
    if (vueInject) {
      const authKey = `${config.name}UpdateUserAuthenticated`;
      const premiumKey = `${config.name}UpdateUserPremium`;

      // Check if providers are already registered to avoid Vue warnings
      if (!registeredProviders.has(authKey)) {
        vueInject(authKey, updateUserAuthenticated);
        registeredProviders.add(authKey);
      }
      if (!registeredProviders.has(premiumKey)) {
        vueInject(premiumKey, updateUserPremium);
        registeredProviders.add(premiumKey);
      }
    }
  };

  const platformCleanup = async () => {
    console.log("Cleaning up platform view");
    canStateLoopRun.value = false;

    // Cleanup all registered event handlers
    registeredHandlers.value.forEach(({ event, handler }) => {
      emitter?.off(event, handler);
    });
    registeredHandlers.value = [];

    // Cleanup registered providers
    const authKey = `${config.name}UpdateUserAuthenticated`;
    const premiumKey = `${config.name}UpdateUserPremium`;
    registeredProviders.delete(authKey);
    registeredProviders.delete(premiumKey);

    // Cleanup account running state
    await setAccountRunning(account.id, false);

    // Cleanup the view controller
    await model.value.cleanup();
  };

  return {
    // Configuration
    config,

    // Feature helpers
    hasFeature,
    requiresPremium,

    // State
    currentState,
    progress,
    currentJobs,
    isPaused,
    canStateLoopRun,
    clickingEnabled,
    userAuthenticated,
    userPremium,

    // Component refs
    speechBubbleComponent,
    webviewComponent,

    // Template props
    accountHeaderProps,
    speechBubbleProps,
    automationNoticeProps,
    webviewProps,

    // Methods
    updateAccount,
    setState,
    startStateLoop,
    updateUserAuthenticated,
    updateUserPremium,
    setupAuthListeners,
    setupPlatformEventHandlers,
    createAutomationHandlers,
    cleanup,
    pause,
    resume,
    initializePlatformView,
    setupProviders,
    platformCleanup,

    // Dependencies
    emitter,
    apiClient,
    deviceInfo,
  };
}
