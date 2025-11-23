<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { formatDistanceToNow } from "date-fns";
import { State } from "../../../view_models/FacebookViewModel";

const { t } = useI18n();

const props = defineProps<{
  accountID: number;
  buttonText: string;
  buttonTextNoData: string;
  buttonState: State;
}>();

const emit = defineEmits<{
  setState: [value: State];
}>();

const lastImportArchive = ref<Date | null>(null);
const lastBuildDatabase = ref<Date | null>(null);

const buttonClicked = async () => {
  console.log(
    "FacebookLastImportOrBuildComponent",
    "buttonClicked",
    props.buttonText,
    props.buttonState,
  );
  emit("setState", props.buttonState);
};

onMounted(async () => {
  const lastFinishedJob_importArchive =
    await window.electron.Facebook.getConfig(
      props.accountID,
      "lastFinishedJob_importArchive",
    );
  if (lastFinishedJob_importArchive) {
    lastImportArchive.value = new Date(lastFinishedJob_importArchive);
  }

  const lastFinishedJob_indexTweets = await window.electron.Facebook.getConfig(
    props.accountID,
    "lastFinishedJob_indexTweets",
  );
  const lastFinishedJob_indexLikes = await window.electron.Facebook.getConfig(
    props.accountID,
    "lastFinishedJob_indexLikes",
  );
  if (lastFinishedJob_indexTweets || lastFinishedJob_indexLikes) {
    const lastFinishedJob_indexTweets_date = lastFinishedJob_indexTweets
      ? new Date(lastFinishedJob_indexTweets)
      : new Date(0);
    const lastFinishedJob_indexLikes_date = lastFinishedJob_indexLikes
      ? new Date(lastFinishedJob_indexLikes)
      : new Date(0);
    lastBuildDatabase.value =
      lastFinishedJob_indexTweets_date > lastFinishedJob_indexLikes_date
        ? lastFinishedJob_indexTweets_date
        : lastFinishedJob_indexLikes_date;
  }
});
</script>

<template>
  <div class="alert alert-light small text-center" role="alert">
    <div v-if="lastImportArchive">
      You last imported your Facebook archive
      {{
        formatDistanceToNow(lastImportArchive, {
          addSuffix: true,
        })
      }}.
    </div>
    <div v-if="lastBuildDatabase">
      You last built your local database from scratch
      {{
        formatDistanceToNow(lastBuildDatabase, {
          addSuffix: true,
        })
      }}.
    </div>
    <div v-if="!lastImportArchive && !lastBuildDatabase">
      <div>{{ t("facebook.cydCanUnfriendEveryone") }}</div>
      <div>
        <i class="fa-solid fa-triangle-exclamation" />
        {{ t("facebook.needImportOrBuildToDelete") }}
      </div>
    </div>
    <button
      type="submit"
      class="btn btn-sm btn-link text-nowrap"
      @click="buttonClicked"
    >
      <template v-if="lastImportArchive || lastBuildDatabase">
        {{ buttonText }}
      </template>
      <template v-else>
        {{ buttonTextNoData }}
      </template>
    </button>
  </div>
</template>

<style scoped></style>
