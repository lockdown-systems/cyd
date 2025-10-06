<script setup lang="ts">
import { ref, getCurrentInstance, onMounted } from "vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import { XImportArchiveResponse } from "../../../../../shared_types";
import { getBreadcrumbIcon } from "../../../util";
import RunningIcon from "../../shared_components/RunningIcon.vue";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Props
const props = defineProps<{
  model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
  updateAccount: [];
  setState: [value: State];
}>();

// Keep track of platform
// Mac users can browse for both ZIP or unzipped folder at once, but Windows and Linux users need two separate buttons
const platform = ref("");

// Buttons
const backClicked = async () => {
  if (props.model.account?.xAccount?.archiveOnly) {
    emit("setState", State.WizardArchiveOnly);
  } else {
    emit("setState", State.WizardImportStart);
  }
};

const createCountString = (importCount: number, skipCount: number) => {
  if (importCount > 0 && skipCount > 0) {
    return `${importCount.toLocaleString()} imported, ${skipCount.toLocaleString()} already imported`;
  } else if (importCount > 0 && skipCount == 0) {
    return `${importCount.toLocaleString()} imported`;
  } else if (importCount == 0 && skipCount > 0) {
    return `${skipCount.toLocaleString()} already imported`;
  } else {
    return "nothing imported";
  }
};

const startClicked = async () => {
  errorMessages.value = [];
  importStarted.value = true;
  let unzippedPath: string | null = null;
  let isZip: boolean = false;

  // Does importFromArchivePath end with .zip?
  if (!importFromArchivePath.value.endsWith(".zip")) {
    unzippedPath = importFromArchivePath.value;
  } else {
    // Unarchive the zip
    isZip = true;
    statusValidating.value = ImportStatus.Active;
    try {
      unzippedPath = await window.electron.X.unzipXArchive(
        props.model.account.id,
        importFromArchivePath.value,
      );
    } catch (e) {
      statusValidating.value = ImportStatus.Failed;
      errorMessages.value.push(`${e}`);
      importFailed.value = true;
      return;
    }
    if (unzippedPath === null) {
      statusValidating.value = ImportStatus.Failed;
      errorMessages.value.push(unzippedPath);
      importFailed.value = true;
      return;
    }
  }

  // Verify that the archive is valid
  statusValidating.value = ImportStatus.Active;
  let verifyResp: string | null = null;
  try {
    verifyResp = await window.electron.X.verifyXArchive(
      props.model.account.id,
      unzippedPath,
    );
  } catch (e) {
    statusValidating.value = ImportStatus.Failed;
    errorMessages.value.push(`${e}`);
    importFailed.value = true;
    // Only delete the unzipped archive if we extracted it from a ZIP file
    if (isZip) {
      await window.electron.X.deleteUnzippedXArchive(
        props.model.account.id,
        unzippedPath,
      );
    }
    return;
  }
  if (verifyResp !== null) {
    statusValidating.value = ImportStatus.Failed;
    errorMessages.value.push(verifyResp);
    importFailed.value = true;
    // Only delete the unzipped archive if we extracted it from a ZIP file
    if (isZip) {
      await window.electron.X.deleteUnzippedXArchive(
        props.model.account.id,
        unzippedPath,
      );
    }
    return;
  }
  statusValidating.value = ImportStatus.Finished;

  // After unzipping and verifying, if we're in archive-only mode, the unzippedPath has changed
  if (props.model.account?.xAccount?.archiveOnly && isZip) {
    unzippedPath = await window.electron.getAccountDataPath(
      props.model.account.id,
      "tmp",
    );
    if (!unzippedPath) {
      statusValidating.value = ImportStatus.Failed;
      errorMessages.value.push(
        "Failed to get account data path for archive-only account",
      );
      importFailed.value = true;
      return;
    }
  }

  // Import tweets
  statusImportingTweets.value = ImportStatus.Active;
  const tweetsResp: XImportArchiveResponse =
    await window.electron.X.importXArchive(
      props.model.account.id,
      unzippedPath,
      "tweets",
    );
  tweetCountString.value = createCountString(
    tweetsResp.importCount,
    tweetsResp.skipCount,
  );
  if (tweetsResp.status == "error") {
    statusImportingTweets.value = ImportStatus.Failed;
    errorMessages.value.push(tweetsResp.errorMessage);
    importFailed.value = true;
  } else {
    statusImportingTweets.value = ImportStatus.Finished;
    // Update the path if it was changed during import (for archive-only accounts)
    if (tweetsResp.updatedArchivePath) {
      unzippedPath = tweetsResp.updatedArchivePath;
    }
  }
  emitter.emit(`x-update-database-stats-${props.model.account.id}`);

  // Import likes
  statusImportingLikes.value = ImportStatus.Active;
  const likesResp: XImportArchiveResponse =
    await window.electron.X.importXArchive(
      props.model.account.id,
      unzippedPath,
      "likes",
    );
  likeCountString.value = createCountString(
    likesResp.importCount,
    likesResp.skipCount,
  );
  if (likesResp.status == "error") {
    statusImportingLikes.value = ImportStatus.Failed;
    errorMessages.value.push(likesResp.errorMessage);
    importFailed.value = true;
  } else {
    statusImportingLikes.value = ImportStatus.Finished;
    // Update the path if it was changed during import (for archive-only accounts)
    if (likesResp.updatedArchivePath) {
      unzippedPath = likesResp.updatedArchivePath;
    }
  }
  emitter.emit(`x-update-database-stats-${props.model.account.id}`);

  // Build Cyd archive
  statusBuildCydArchive.value = ImportStatus.Active;
  try {
    await window.electron.X.archiveBuild(props.model.account.id);
  } catch (e) {
    statusBuildCydArchive.value = ImportStatus.Failed;
    errorMessages.value.push(`${e}`);
    importFailed.value = true;
    await window.electron.X.deleteUnzippedXArchive(
      props.model.account.id,
      unzippedPath,
    );
    return;
  }
  emitter.emit(`x-update-archive-info-${props.model.account.id}`);
  statusBuildCydArchive.value = ImportStatus.Finished;

  // If we unarchived it, delete the unarchived folder whether it's success or fail
  if (isZip) {
    await window.electron.X.deleteUnzippedXArchive(
      props.model.account.id,
      unzippedPath,
    );
  }

  // Success
  if (!importFailed.value) {
    await window.electron.X.setConfig(
      props.model.account.id,
      "lastFinishedJob_importArchive",
      new Date().toISOString(),
    );
    importFinished.value = true;

    // Reload the account data to reflect the updated username
    await props.model.reloadAccount();
    emitter.emit("account-updated");
  }
};

const importFromArchiveBrowseClicked = async () => {
  const path = await window.electron.showOpenDialog(true, true, [
    { name: "ZIP Archive", extensions: ["zip"] },
  ]);
  if (path) {
    importFromArchivePath.value = path;
  }
};

const importFromArchiveBrowseZipClicked = async () => {
  const path = await window.electron.showOpenDialog(false, true, [
    { name: "ZIP Archive", extensions: ["zip"] },
  ]);
  if (path) {
    importFromArchivePath.value = path;
  }
};

const importFromArchiveBrowseFolderClicked = async () => {
  const path = await window.electron.showOpenDialog(true, false, undefined);
  if (path) {
    importFromArchivePath.value = path;
  }
};

// Keep track of import status

const importFromArchivePath = ref("");
const errorMessages = ref();

const importStarted = ref(false);
const importFinished = ref(false);
const importFailed = ref(false);

enum ImportStatus {
  Pending,
  Active,
  Finished,
  Failed,
}

const statusValidating = ref(ImportStatus.Pending);
const statusImportingTweets = ref(ImportStatus.Pending);
const statusImportingLikes = ref(ImportStatus.Pending);
const statusBuildCydArchive = ref(ImportStatus.Pending);

const tweetCountString = ref("");
const likeCountString = ref("");

const iconFromStatus = (status: ImportStatus) => {
  switch (status) {
    case ImportStatus.Pending:
      return "fa-solid fa-ellipsis text-primary";
    case ImportStatus.Finished:
      return "fa-solid fa-square-check text-success";
    case ImportStatus.Failed:
      return "fa-solid fa-circle-exclamation text-danger";
  }
};

onMounted(async () => {
  platform.value = await window.electron.getPlatform();
});
</script>

<template>
  <BaseWizardPage
    :breadcrumb-props="{
      buttons: [
        {
          label: 'Dashboard',
          action: () => emit('setState', State.WizardDashboard),
          icon: getBreadcrumbIcon('dashboard'),
        },
        ...(props.model.account?.xAccount?.archiveOnly
          ? []
          : [
              {
                label: 'Local Database',
                action: backClicked,
                icon: getBreadcrumbIcon('database'),
              },
            ]),
        {
          label: 'Import X Archive',
          action: backClicked,
          icon: getBreadcrumbIcon('import'),
        },
      ],
      label: 'Importing',
      icon: getBreadcrumbIcon('import'),
    }"
    :button-props="
      !importStarted
        ? {
            backButtons: [
              { label: 'Back to Import X Archive', action: backClicked },
            ],
            nextButtons: [
              {
                label: 'Start Import',
                action: startClicked,
                disabled: importFromArchivePath == '',
              },
            ],
          }
        : importFinished ||
            (importFailed && props.model.account?.xAccount?.archiveOnly)
          ? {
              backButtons: [
                {
                  label: props.model.account?.xAccount?.archiveOnly
                    ? 'Back to Import X Archive'
                    : 'Back to Import from X',
                  action: () =>
                    emit(
                      'setState',
                      props.model.account?.xAccount?.archiveOnly
                        ? State.WizardArchiveOnly
                        : State.WizardImportStart,
                    ),
                },
              ],
              nextButtons: [
                {
                  label: 'Backup More Data from X',
                  action: () => emit('setState', State.WizardArchiveOptions),
                  hide:
                    props.model.account?.xAccount?.archiveOnly || importFailed,
                },
                {
                  label: 'Go to Dashboard',
                  action: () => emit('setState', State.WizardDashboard),
                },
              ],
            }
          : {
              backButtons: [],
              nextButtons: [],
            }
    "
  >
    <template #content>
      <div class="wizard-scroll-content">
        <h2>Import your X archive</h2>
        <p class="text-muted">
          <template v-if="!importStarted">
            Browse for the ZIP file of the X archive you downloaded, or the
            folder where you have already extracted it.
          </template>
          <template v-else> Importing your archive... </template>
        </p>

        <template v-if="!importStarted">
          <div class="input-group">
            <input
              v-model="importFromArchivePath"
              type="text"
              class="form-control"
              placeholder="Import your X archive"
              readonly
            />
            <template v-if="platform == 'darwin'">
              <button
                class="btn btn-secondary"
                @click="importFromArchiveBrowseClicked"
              >
                Browse for Archive
              </button>
            </template>
            <template v-else>
              <button
                class="btn btn-secondary me-1"
                @click="importFromArchiveBrowseZipClicked"
              >
                Browse for ZIP
              </button>
              <button
                class="btn btn-secondary"
                @click="importFromArchiveBrowseFolderClicked"
              >
                Browse for Unzipped Folder
              </button>
            </template>
          </div>
        </template>
        <template v-else>
          <ul class="import-status">
            <li
              :class="
                statusValidating == ImportStatus.Pending ? 'text-muted' : ''
              "
            >
              <i
                v-if="statusValidating != ImportStatus.Active"
                :class="['fa', iconFromStatus(statusValidating)]"
              />
              <i v-else>
                <RunningIcon />
              </i>
              Validating X archive
            </li>
            <li
              :class="
                statusImportingTweets == ImportStatus.Pending
                  ? 'text-muted'
                  : ''
              "
            >
              <i
                v-if="statusImportingTweets != ImportStatus.Active"
                :class="['fa', iconFromStatus(statusImportingTweets)]"
              />
              <i v-else>
                <RunningIcon />
              </i>
              Importing tweets
              <span v-if="tweetCountString != ''" class="text-muted">
                ({{ tweetCountString }})
              </span>
            </li>
            <li
              :class="
                statusImportingLikes == ImportStatus.Pending ? 'text-muted' : ''
              "
            >
              <i
                v-if="statusImportingLikes != ImportStatus.Active"
                :class="['fa', iconFromStatus(statusImportingLikes)]"
              />
              <i v-else>
                <RunningIcon />
              </i>
              Importing likes
              <span v-if="likeCountString != ''" class="text-muted">
                ({{ likeCountString }})
              </span>
            </li>
            <li
              :class="
                statusBuildCydArchive == ImportStatus.Pending
                  ? 'text-muted'
                  : ''
              "
            >
              <i
                v-if="statusBuildCydArchive != ImportStatus.Active"
                :class="['fa', iconFromStatus(statusBuildCydArchive)]"
              />
              <i v-else>
                <RunningIcon />
              </i>
              Build Cyd archive
            </li>
          </ul>

          <template v-if="importFinished">
            <div class="alert alert-success mt-3">
              <i class="fa-solid fa-check" />
              Import finished successfully!
            </div>
            <p
              v-if="!props.model.account?.xAccount?.archiveOnly"
              class="small text-muted"
            >
              Cyd can backup even more data from your X account that isn't
              included in your archive. If you don't care about this, you're
              ready to delete or migrate your data now.
            </p>
            <p
              v-if="props.model.account?.xAccount?.archiveOnly"
              class="small text-muted"
            >
              You're ready to migrate your data now.
            </p>
          </template>
          <template v-if="importFailed">
            <div
              v-for="errorMessage in errorMessages"
              :key="errorMessage"
              class="alert alert-danger mt-3 text-break"
            >
              <strong>Import failed.</strong> {{ errorMessage }}
            </div>
          </template>
        </template>
      </div>
    </template>
  </BaseWizardPage>
</template>

<style scoped>
ul.import-status {
  list-style-type: none;
  padding: 1rem 3rem;
}

ul.import-status li {
  margin-bottom: 0.5rem;
}

ul.import-status li i {
  margin-right: 0.5rem;
}
</style>
