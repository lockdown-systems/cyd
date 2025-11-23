<script setup lang="ts">
import { ref, onMounted, getCurrentInstance } from "vue";
import { useI18n } from "vue-i18n";
import { State, XViewModel } from "../../../view_models/XViewModel";
import {
  XDatabaseStats,
  emptyXDatabaseStats,
} from "../../../../../shared_types";
import SidebarArchive from "../../shared_components/SidebarArchive.vue";
import SidebarCard from "../../shared_components/SidebarCard.vue";
import DebugModeComponent from "../../shared_components/DebugModeComponent.vue";
import { xGetLastImportArchive } from "../../../util_x";

const { t } = useI18n();

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Props
const props = defineProps<{
  model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
  setState: [value: State];
  setDebugAutopauseEndOfStep: [value: boolean];
}>();

// Buttons
const reloadUserStats = async () => {
  await window.electron.X.setConfig(
    props.model.account?.id,
    "reloadUserStats",
    "true",
  );
  emit("setState", State.WizardPrestart);
};

// Keep databaseStats in sync
const databaseStats = ref<XDatabaseStats>(emptyXDatabaseStats());
emitter?.on(`x-update-database-stats-${props.model.account.id}`, async () => {
  databaseStats.value = await window.electron.X.getDatabaseStats(
    props.model.account.id,
  );
});

// Check if sidebar should be hidden
const shouldHideSidebar = ref(false);

const updateSidebarVisibility = async () => {
  if (props.model.account?.xAccount?.archiveOnly) {
    const lastImportArchive = await xGetLastImportArchive(
      props.model.account.id,
    );
    shouldHideSidebar.value = lastImportArchive === null;
  }
};

onMounted(async () => {
  databaseStats.value = await window.electron.X.getDatabaseStats(
    props.model.account.id,
  );
  await updateSidebarVisibility();
});

// Listen for account updates to refresh sidebar visibility
emitter?.on("account-updated", async () => {
  await updateSidebarVisibility();
});
</script>

<template>
  <div v-if="!shouldHideSidebar" class="wizard-sidebar">
    <p
      v-if="
        model.account &&
        model.account.xAccount &&
        !model.account?.xAccount?.archiveOnly
      "
      class="p-1 small text-muted"
    >
      <template
        v-if="
          model.account?.xAccount?.tweetsCount == -1 ||
          model.account?.xAccount?.likesCount == -1
        "
      >
        Cyd could not detect how many likes and tweets you have.
        <a href="#" @click="reloadUserStats"> Try again. </a>
      </template>
      <template v-else>
        According to X, your account has
        <strong class="text-nowrap"
          >{{
            model.account?.xAccount?.tweetsCount.toLocaleString()
          }}
          tweets</strong
        >
        and
        <strong class="text-nowrap"
          >{{
            model.account?.xAccount?.likesCount.toLocaleString()
          }}
          likes</strong
        >. These numbers aren't always accurate.
        <a href="#" @click="reloadUserStats"> Refresh the stats. </a>
      </template>
    </p>

    <SidebarArchive
      :account-i-d="model.account.id"
      :account-type="model.account.type"
    />

    <div class="stats container mt-4">
      <div class="row g-2">
        <SidebarCard
          v-if="databaseStats.tweetsSaved > 0"
          header="Tweets Saved"
          :stat="databaseStats.tweetsSaved"
        />
        <SidebarCard
          v-if="databaseStats.tweetsDeleted > 0"
          header="Tweets Deleted"
          :stat="databaseStats.tweetsDeleted"
        />
        <SidebarCard
          v-if="databaseStats.tweetsMigratedToBluesky > 0"
          :header="`<div>${t('sidebar.migratedTo')} <i class='fa-brands fa-bluesky' /></div>`"
          :stat="databaseStats.tweetsMigratedToBluesky"
        />
        <SidebarCard
          v-if="databaseStats.retweetsSaved > 0"
          header="Retweets Saved"
          :stat="databaseStats.retweetsSaved"
        />
        <SidebarCard
          v-if="databaseStats.retweetsDeleted > 0"
          header="Retweets Deleted"
          :stat="databaseStats.retweetsDeleted"
        />
        <SidebarCard
          v-if="databaseStats.likesSaved > 0"
          header="Likes Saved"
          :stat="databaseStats.likesSaved"
        />
        <SidebarCard
          v-if="databaseStats.likesDeleted > 0"
          header="Likes Deleted"
          :stat="databaseStats.likesDeleted"
        />
        <SidebarCard
          v-if="databaseStats.bookmarksSaved > 0"
          header="Bookmarks Saved"
          :stat="databaseStats.bookmarksSaved"
        />
        <SidebarCard
          v-if="databaseStats.bookmarksDeleted > 0"
          header="Bookmarks Deleted"
          :stat="databaseStats.bookmarksDeleted"
        />
        <SidebarCard
          v-if="databaseStats.conversationsDeleted > 0"
          header="Conversations Deleted"
          :stat="databaseStats.conversationsDeleted"
        />
        <SidebarCard
          v-if="databaseStats.accountsUnfollowed > 0"
          header="Accounts Unfollowed"
          :stat="databaseStats.accountsUnfollowed"
        />
      </div>
    </div>

    <DebugModeComponent :emit="emit" :debug-state="State.Debug" />
  </div>
</template>

<style scoped></style>
