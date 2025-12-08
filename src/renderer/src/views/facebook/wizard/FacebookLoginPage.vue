<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <div class="wizard-content">
    <div class="wizard-scroll-content login">
      <div class="login-card card">
        <div class="card-body">
          <h2 class="mb-3">{{ t("facebook.loginTitle") }}</h2>
          <p class="text-muted mb-4">
            {{ t("facebook.loginDescription") }}
          </p>
          <ol class="text-start">
            <li>{{ t("facebook.loginStepOpen") }}</li>
            <li>{{ t("facebook.loginStepComplete") }}</li>
            <li>{{ t("facebook.loginStepReturn") }}</li>
          </ol>
          <p class="text-muted small mt-4">
            {{ t("facebook.loginHelpText") }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wizard-scroll-content.login {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.login-card {
  max-width: 640px;
  width: 100%;
}

ol {
  margin-left: 1rem;
}
</style>
