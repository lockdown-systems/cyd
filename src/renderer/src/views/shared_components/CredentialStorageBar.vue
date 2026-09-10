<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";

import type { CredentialProtection } from "../../../../shared_types";

const { t } = useI18n();

const props = defineProps<{
  // Null until the main process has reported how credentials are protected.
  protection: CredentialProtection | null;
}>();

// Cyd may only claim the protection the selected backend actually provides,
// so an unprotected or unrecognized backend is disclosed rather than hidden.
const shouldDisclose = computed(
  () => props.protection?.disclosureRequired === true,
);

const message = computed(() => {
  if (props.protection?.canPersist === false) {
    return t("app.credentialStorage.unavailable");
  }
  return t("app.credentialStorage.unprotectedLinux");
});

// Naming the backend keeps the warning honest and checkable: the user can
// compare it against what their desktop actually provides.
const backendName = computed(
  () => props.protection?.rawBackend ?? props.protection?.backend ?? "",
);

// Dismissing hides the bar for the rest of the session. The limitation is
// permanent until the user installs a keyring, so nagging on every render
// helps nobody; the next launch discloses it again.
const dismissed = ref(false);
</script>

<template>
  <div
    v-if="shouldDisclose && !dismissed"
    class="credential-storage-bar"
    role="alert"
  >
    <button
      type="button"
      class="btn-close credential-storage-bar-close"
      :aria-label="t('app.credentialStorage.dismiss')"
      @click="dismissed = true"
    ></button>
    <p>
      <strong>{{ t("app.credentialStorage.unprotectedTitle") }}</strong>
    </p>
    <p class="text-muted">
      {{ message }}
      <span class="credential-storage-backend">({{ backendName }})</span>
    </p>
  </div>
</template>

<style scoped>
.credential-storage-bar {
  position: relative;
  padding: 0.75rem 2rem 0.75rem 1rem;
  background-color: var(--bs-warning-bg-subtle, #fff3cd);
  border-top: 1px solid var(--bs-warning-border-subtle, #ffe69c);
}

.credential-storage-bar p {
  margin-bottom: 0;
}

.credential-storage-bar-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}
</style>
