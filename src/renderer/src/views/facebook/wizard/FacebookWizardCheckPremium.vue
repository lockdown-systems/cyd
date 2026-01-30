<script setup lang="ts">
import { getCurrentInstance } from "vue";
import { useI18n } from "vue-i18n";
import { FacebookViewModel } from "../../../view_models/FacebookViewModel";
import { PlatformStates } from "../../../types/PlatformStates";

const { t } = useI18n();

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Props
const props = defineProps<{
  model: FacebookViewModel;
  userAuthenticated: boolean;
  userPremium: boolean;
}>();

// Emits
const emit = defineEmits<{
  setState: [value: string];
  updateUserPremium: [];
}>();

// Buttons
const signInClicked = async () => {
  emitter?.emit("show-sign-in");
};

const manageAccountClicked = async () => {
  emitter?.emit("show-manage-account");
};

const iveUpgradedClicked = async () => {
  emit("updateUserPremium");
};

const backClicked = async () => {
  emit("setState", PlatformStates.FacebookWizardDashboard);
};

const continueToDeleteOptions = async () => {
  emit("setState", PlatformStates.WizardDeleteOptions);
};

// Listen for premium check failed event
emitter?.on(
  `facebook-premium-check-failed-${props.model.account.id}`,
  async () => {
    // Show error message - handled in template via userPremium state
  },
);
</script>

<template>
  <div class="wizard-content container mb-4 mt-3 mx-auto wizard-review">
    <h2 v-if="userAuthenticated && userPremium">
      {{ t("premium.thanksForUpgrading") }}
      <i class="fa-solid fa-heart" />
    </h2>

    <template v-if="!userAuthenticated">
      <p>{{ t("premium.signInToGetStarted") }}</p>
    </template>
    <template v-else-if="userAuthenticated && !userPremium">
      <p>{{ t("premium.manageAccountToUpgrade") }}</p>
    </template>
    <template v-else>
      <p>
        {{ t("facebook.premium.readyToDelete") }}
        <em>{{ t("premium.letsGo") }}</em>
      </p>
    </template>

    <form @submit.prevent>
      <div class="buttons">
        <button
          v-if="!userAuthenticated"
          type="submit"
          class="btn btn-lg btn-primary text-nowrap m-1"
          @click="signInClicked"
        >
          <i class="fa-solid fa-user-ninja" />
          {{ t("premium.signIn") }}
        </button>

        <div v-else-if="userAuthenticated && !userPremium">
          <button
            type="submit"
            class="btn btn-primary text-nowrap m-1"
            @click="manageAccountClicked"
          >
            <i class="fa-solid fa-user-ninja" />
            {{ t("premium.manageMyAccount") }}
          </button>

          <button
            type="submit"
            class="btn btn-success text-nowrap m-1"
            @click="iveUpgradedClicked"
          >
            <i class="fa-solid fa-star" />
            {{ t("premium.iveUpgraded") }}
          </button>
        </div>

        <div v-else>
          <button
            type="submit"
            class="btn btn-lg btn-primary text-nowrap m-1"
            @click="continueToDeleteOptions"
          >
            <i class="fa-solid fa-trash" />
            {{ t("facebook.premium.continueToDeleteOptions") }}
          </button>
        </div>
      </div>

      <div v-if="!userPremium" class="buttons">
        <button
          type="submit"
          class="btn btn-secondary text-nowrap m-1"
          @click="backClicked"
        >
          <i class="fa-solid fa-backward" />
          {{ t("wizard.backToDashboard") }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
ul.features-list {
  list-style-type: none;
  padding-left: 0;
}
</style>
