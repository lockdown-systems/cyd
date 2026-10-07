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

// Each case gets its own words. Telling someone their desktop has no keyring
// when Cyd simply did not recognize their password store would be a guess
// dressed as a diagnosis.
const message = computed(() => {
  switch (props.protection?.backend) {
    case "basic_text":
      return t("app.credentialStore.noKeyring");
    case "unknown":
      return t("app.credentialStore.unrecognizedKeyring");
    default:
      return t("app.credentialStore.unavailable");
  }
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
    class="credential-store-bar"
    role="alert"
  >
    <button
      type="button"
      class="btn-close credential-store-bar-close"
      :aria-label="t('app.credentialStore.dismiss')"
      @click="dismissed = true"
    ></button>
    <p>
      <strong>{{ t("app.credentialStore.unprotectedTitle") }}</strong>
    </p>
    <p class="text-muted">
      {{ message }}
      <span class="credential-store-backend">{{
        t("app.credentialStore.backendLabel", { backend: backendName })
      }}</span>
    </p>
  </div>
</template>

<style scoped>
.credential-store-bar {
  /* A disclosure the user has to scroll to find is not a disclosure, so this
     is pinned to the bottom of the window rather than left in the document
     flow. It sits above the updates bar, which moves up to make room. */
  z-index: 101;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.6rem 2.5rem 0.6rem 1rem;
  background-color: var(--bs-warning-bg-subtle, #fff3cd);
  border-top: 1px solid var(--bs-warning-border-subtle, #ffe69c);
}

.credential-store-bar p {
  margin-bottom: 0;
}

.credential-store-bar-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}
</style>
