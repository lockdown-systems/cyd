<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { openURL } from "../../util";
import { UpdateStatus } from "../../types";

const { t } = useI18n();

defineProps<{
  updateStatus: UpdateStatus;
  platform: string;
}>();

const emit = defineEmits<{
  restartToUpdateClicked: [];
}>();

// Dismissing hides the bar for the rest of the session, whatever it's
// showing. Update information is still reachable from the hamburger menu's
// "check for updates". App unmounts this component when updates stop being
// available, which intentionally resets the dismissal, so a new update is
// shown even if an earlier one was dismissed.
const dismissed = ref(false);
</script>

<template>
  <div v-if="!dismissed" class="updates-bar">
    <button
      type="button"
      class="btn-close updates-bar-close"
      :aria-label="t('app.updates.dismiss')"
      @click="dismissed = true"
    ></button>
    <p>
      <strong>{{ t("app.updates.updateAvailable") }}</strong>
      {{ t("app.updates.shouldUseLatestVersion") }}
    </p>
    <p class="text-muted">
      <template v-if="platform === 'linux'">
        {{ t("app.updates.installViaPackageManager") }}
      </template>
      <template v-else>
        <template v-if="updateStatus == UpdateStatus.Checking">
          {{ t("app.updates.loadingUpdateStatus") }}
        </template>
        <template v-else-if="updateStatus == UpdateStatus.Available">
          {{ t("app.updates.downloadingUpdate") }}
        </template>
        <template v-else-if="updateStatus == UpdateStatus.Downloaded">
          <button
            class="btn btn-primary"
            @click="emit('restartToUpdateClicked')"
          >
            {{ t("app.updates.restartToUpdate") }}
          </button>
        </template>
        <template
          v-else-if="
            updateStatus == UpdateStatus.Error ||
            updateStatus == UpdateStatus.NotAvailable
          "
        >
          {{ t("app.updates.errorWithAutomaticUpdate") }}
          <a href="#" @click="openURL('https://cyd.social/download/')">{{
            t("app.updates.fromWebsite")
          }}</a
          >.
        </template>
      </template>
    </p>
  </div>
</template>

<style scoped></style>
