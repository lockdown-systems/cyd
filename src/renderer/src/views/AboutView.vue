<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const currentYear = new Date().getFullYear();
const appVersion = ref("");
const mode = ref("prod");

defineProps<{
  shouldShow: boolean;
}>();

const sourceClicked = async () => {
  await window.electron.openURL("https://github.com/lockdown-systems/cyd");
};

const privacyClicked = async () => {
  await window.electron.openURL("https://cyd.social/privacy/");
};

const termsClicked = async () => {
  await window.electron.openURL("https://cyd.social/terms/");
};

const creditsClicked = async () => {
  await window.electron.openURL("https://cyd.social/credits/");
};

onMounted(async () => {
  appVersion.value = await window.electron.getVersion();
  mode.value = await window.electron.getMode();
});
</script>

<template>
  <div
    v-if="shouldShow"
    class="d-flex flex-column justify-content-between vh-100"
  >
    <div class="d-flex justify-content-center align-items-center flex-grow-1">
      <div class="text-center">
        <div>
          <img
            src="/assets/cyd-tmkf.svg"
            :alt="t('common.thisMachineKillsFascists')"
            class="kills-fascists"
          />
        </div>
      </div>
    </div>
    <div class="text-center">
      <p>{{ t("common.findBugOrNeedHelp") }}</p>
      <p class="text-muted">
        <img
          src="/assets/wordmark.svg"
          class="cyd-wordmark mr-2"
          :alt="t('common.cyd')"
        />
        {{ mode != "prod" ? "Dev" : "" }}
        version {{ appVersion }}
      </p>
      <p class="text-muted">
        Copyright © Lockdown Systems LLC {{ currentYear }}, licensed under
        GPLv3<br />
        <span class="btn btn-link" @click="sourceClicked">{{
          t("about.sourceCode")
        }}</span>
        <span class="btn btn-link" @click="privacyClicked">{{
          t("about.privacyPolicy")
        }}</span>
        <span class="btn btn-link" @click="termsClicked">{{
          t("about.termsOfUse")
        }}</span>
        <span class="btn btn-link" @click="creditsClicked">{{
          t("about.credits")
        }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.kills-fascists {
  width: 350px;
}

.cyd-wordmark {
  height: 2em;
}
</style>
