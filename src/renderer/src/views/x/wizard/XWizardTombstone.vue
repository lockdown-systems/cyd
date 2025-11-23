<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import {
  XViewModel,
  State,
  tombstoneUpdateBioCreditCydText,
} from "../../../view_models/XViewModel";
import { setJobsType, getBreadcrumbIcon } from "../../../util";
import {
  TombstoneBannerBackground,
  TombstoneBannerSocialIcons,
} from "../../../types_x";
import { useWizardPage } from "../../../composables/useWizardPage";
import XTombstoneBannerComponent from "../components/XTombstoneBannerComponent.vue";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";

const { t } = useI18n();

// Props
const props = defineProps<{
  model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
  updateAccount: [];
  setState: [value: State];
}>();

// Use wizard page light for state management
const { isLoading, setLoading } = useWizardPage();

// Buttons
const backClicked = () => {
  emit("setState", State.WizardDashboard);
};

const nextClicked = async () => {
  setLoading(true);
  try {
    await saveSettings();
    setJobsType(props.model.account.id, "tombstone");
    emit("setState", State.WizardReview);
  } finally {
    setLoading(false);
  }
};

// Settings
const updateBanner = ref(true);
const updateBannerBackground = ref<TombstoneBannerBackground>(
  TombstoneBannerBackground.Night,
);
const updateBannerSocialIcons = ref<TombstoneBannerSocialIcons>(
  TombstoneBannerSocialIcons.None,
);
const updateBannerShowText = ref(true);
const updateBio = ref(true);
const updateBioText = ref("");
const updateBioCreditCyd = ref(true);
const lockAccount = ref(true);

const loadSettings = async () => {
  console.log("XWizardTombstone", "loadSettings");
  const account = await window.electron.database.getAccount(
    props.model.account?.id,
  );
  if (account && account.xAccount) {
    updateBanner.value = account.xAccount.tombstoneUpdateBanner;
    if (account.xAccount.tombstoneUpdateBannerBackground == "morning") {
      updateBannerBackground.value = TombstoneBannerBackground.Morning;
    } else {
      // default to night
      updateBannerBackground.value = TombstoneBannerBackground.Night;
    }
    if (account.xAccount.tombstoneUpdateBannerSocialIcons == "bluesky") {
      updateBannerSocialIcons.value = TombstoneBannerSocialIcons.Bluesky;
    } else if (
      account.xAccount.tombstoneUpdateBannerSocialIcons == "mastodon"
    ) {
      updateBannerSocialIcons.value = TombstoneBannerSocialIcons.Mastodon;
    } else if (
      account.xAccount.tombstoneUpdateBannerSocialIcons == "bluesky-mastodon"
    ) {
      updateBannerSocialIcons.value =
        TombstoneBannerSocialIcons.BlueskyMastodon;
    } else if (
      account.xAccount.tombstoneUpdateBannerSocialIcons == "mastodon-bluesky"
    ) {
      updateBannerSocialIcons.value =
        TombstoneBannerSocialIcons.MastodonBluesky;
    } else {
      // default to none
      updateBannerSocialIcons.value = TombstoneBannerSocialIcons.None;
    }
    updateBannerShowText.value = account.xAccount.tombstoneUpdateBannerShowText;
    updateBio.value = account.xAccount.tombstoneUpdateBio;
    updateBioCreditCyd.value = account.xAccount.tombstoneUpdateBioCreditCyd;
    lockAccount.value = account.xAccount.tombstoneLockAccount;
    // Pull bio text what's in their X profile, not their tombstone bio text
    updateBioText.value = account.xAccount.bio ? account.xAccount.bio : "";
  }
};

const loadImage = async (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

const imageToCanvas = async (
  img: HTMLImageElement,
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return canvas;
};

const mergeCanvases = async (
  bgCanvas: HTMLCanvasElement,
  fgCanvas: HTMLCanvasElement,
): Promise<HTMLCanvasElement> => {
  const width = Math.max(bgCanvas.width, fgCanvas.width);
  const height = Math.max(bgCanvas.height, fgCanvas.height);
  const mergedCanvas = document.createElement("canvas");
  mergedCanvas.width = width;
  mergedCanvas.height = height;
  const ctx = mergedCanvas.getContext("2d")!;
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.drawImage(fgCanvas, 0, 0);
  return mergedCanvas;
};

const buildBannerImage = async (): Promise<string> => {
  if (!updateBanner.value) {
    return "";
  }

  // Background
  let bgUrl: string;
  if (updateBannerBackground.value == TombstoneBannerBackground.Night) {
    bgUrl = "/assets/tombstone-bg-night.png";
  } else {
    bgUrl = "/assets/tombstone-bg-morning.png";
  }
  const bgImg = await loadImage(bgUrl);
  const bgCanvas = await imageToCanvas(bgImg);

  // Foreground
  const fgImg = await loadImage("/assets/tombstone-foreground.png");
  const fgCanvas = await imageToCanvas(fgImg);

  // Merged background and foreground
  let bannerCanvas = await mergeCanvases(bgCanvas, fgCanvas);

  // Is there a text layer?
  if (updateBannerShowText.value) {
    const textImg = await loadImage("/assets/tombstone-text.png");
    const textCanvas = await imageToCanvas(textImg);
    bannerCanvas = await mergeCanvases(bannerCanvas, textCanvas);
  }

  // Is there a social icon layer?
  if (updateBannerSocialIcons.value != TombstoneBannerSocialIcons.None) {
    let socialUrl: string;
    switch (updateBannerSocialIcons.value) {
      case TombstoneBannerSocialIcons.Bluesky:
        socialUrl = "/assets/tombstone-social-bluesky.png";
        break;
      case TombstoneBannerSocialIcons.Mastodon:
        socialUrl = "/assets/tombstone-social-mastodon.png";
        break;
      case TombstoneBannerSocialIcons.BlueskyMastodon:
        socialUrl = "/assets/tombstone-social-bluesky-mastodon.png";
        break;
      case TombstoneBannerSocialIcons.MastodonBluesky:
        socialUrl = "/assets/tombstone-social-mastodon-bluesky.png";
        break;
    }
    const socialImg = await loadImage(socialUrl);
    const socialCanvas = await imageToCanvas(socialImg);
    bannerCanvas = await mergeCanvases(bannerCanvas, socialCanvas);
  }
  return bannerCanvas.toDataURL("image/png");
};

const saveSettings = async () => {
  console.log("XWizardTombstone", "saveSettings");
  if (!props.model.account) {
    console.error("XWizardTombstone", "saveSettings", "account is null");
    return;
  }
  const bannerDataURL = await buildBannerImage();
  const account = await window.electron.database.getAccount(
    props.model.account?.id,
  );
  if (account && account.xAccount) {
    account.xAccount.tombstoneUpdateBanner = updateBanner.value;
    account.xAccount.tombstoneUpdateBannerBackground =
      updateBannerBackground.value;
    account.xAccount.tombstoneUpdateBannerSocialIcons =
      updateBannerSocialIcons.value;
    account.xAccount.tombstoneUpdateBannerShowText = updateBannerShowText.value;
    account.xAccount.tombstoneBannerDataURL = bannerDataURL;
    account.xAccount.tombstoneUpdateBio = updateBio.value;
    account.xAccount.tombstoneUpdateBioText = updateBioText.value;
    account.xAccount.tombstoneUpdateBioCreditCyd = updateBioCreditCyd.value;
    account.xAccount.tombstoneLockAccount = lockAccount.value;
    await window.electron.database.saveAccount(JSON.stringify(account));
    emit("updateAccount");
  }
};

const bioCharacters = computed(() => {
  if (updateBioCreditCyd.value) {
    return tombstoneUpdateBioCreditCydText.length + updateBioText.value.length;
  } else {
    return updateBioText.value.length;
  }
});

const bioCharactersLeft = computed(() => {
  if (updateBioCreditCyd.value) {
    return (
      160 - tombstoneUpdateBioCreditCydText.length - updateBioText.value.length
    );
  } else {
    return 160 - updateBioText.value.length;
  }
});

// Dynamic button label based on selections
const nextButtonLabel = computed(() => {
  if (updateBanner.value && updateBio.value && lockAccount.value) {
    return t("wizard.updateMyBannerAndBioAndLock");
  } else if (updateBanner.value && updateBio.value) {
    return t("wizard.updateMyBannerAndBio");
  } else if (updateBanner.value && lockAccount.value) {
    return t("wizard.updateMyBannerAndLock");
  } else if (updateBio.value && lockAccount.value) {
    return t("wizard.updateMyBioAndLock");
  } else if (updateBanner.value) {
    return t("wizard.updateMyBanner");
  } else if (updateBio.value) {
    return t("wizard.updateMyBio");
  } else if (lockAccount.value) {
    return t("wizard.lockMyAccount");
  } else {
    return t("wizard.selectCheckboxToContinue");
  }
});

// Next button should be disabled if nothing is selected or bio is too long
const isNextDisabled = computed(() => {
  return (
    !(updateBanner.value || updateBio.value || lockAccount.value) ||
    (updateBio.value && bioCharactersLeft.value < 0)
  );
});

onMounted(async () => {
  console.log("XWizardTombstone", "onMounted");
  setLoading(true);
  try {
    await loadSettings();
  } finally {
    setLoading(false);
  }
});
</script>

<template>
  <BaseWizardPage
    :breadcrumb-props="{
      buttons: [
        {
          label: t('wizard.dashboard'),
          action: () => emit('setState', State.WizardDashboard),
          icon: getBreadcrumbIcon('dashboard'),
        },
      ],
      label: t('wizard.tombstone'),
      icon: getBreadcrumbIcon('tombstone'),
    }"
    :button-props="{
      backButtons: [
        {
          label: t('wizard.backToDashboard'),
          action: backClicked,
          disabled: isLoading,
        },
      ],
      nextButtons: [
        {
          label: nextButtonLabel,
          action: nextClicked,
          disabled: isLoading || isNextDisabled,
        },
      ],
    }"
  >
    <template #content>
      <div class="wizard-scroll-content">
        <div class="mb-4">
          <h2>{{ t('wizard.helloDarkness') }}</h2>
          <p class="text-muted">
            {{ t('wizard.timeToMoveOn') }}
          </p>

          <form @submit.prevent>
            <div class="mb-3">
              <div class="form-check">
                <input
                  id="updateBanner"
                  v-model="updateBanner"
                  type="checkbox"
                  class="form-check-input"
                />
                <label class="form-check-label" for="updateBanner"
                  >{{ t('wizard.updateProfileBanner') }}</label
                >
              </div>
              <div class="indent">
                <small class="form-text text-muted">
                  {{ t('wizard.bannerDescription') }}
                </small>
              </div>
            </div>
            <div class="indent">
              <div class="mb-1 d-flex align-items-center">
                <label
                  class="form-check-label me-2 text-nowrap"
                  for="updateBannerBackground"
                >
                  {{ t('wizard.background') }}
                </label>
                <select
                  id="updateBannerBackground"
                  v-model="updateBannerBackground"
                  class="form-select w-auto"
                  :aria-label="t('wizard.background')"
                  :disabled="!updateBanner"
                >
                  <option value="night">Night</option>
                  <option value="morning">Morning</option>
                </select>
              </div>
              <div class="mb-1 d-flex align-items-center">
                <label
                  class="form-check-label me-2 text-nowrap"
                  for="updateBannerSocialIcons"
                >
                  {{ t('wizard.socialIcons') }}
                </label>
                <select
                  id="updateBannerSocialIcons"
                  v-model="updateBannerSocialIcons"
                  class="form-select w-auto"
                  :aria-label="t('wizard.socialIcons')"
                  :disabled="!updateBanner"
                >
                  <option value="none">{{ t('wizard.none') }}</option>
                  <option value="bluesky">{{ t('wizard.bluesky') }}</option>
                  <option value="mastodon">{{ t('wizard.mastodon') }}</option>
                  <option value="bluesky-mastodon">
                    {{ t('wizard.blueskyMastodon') }}
                  </option>
                  <option value="mastodon-bluesky">
                    {{ t('wizard.mastodonBluesky') }}
                  </option>
                </select>
              </div>
              <div class="mb-3 form-check">
                <input
                  id="updateBannerShowText"
                  v-model="updateBannerShowText"
                  type="checkbox"
                  class="form-check-input"
                  :disabled="!updateBanner"
                />
                <label class="form-check-label" for="updateBannerShowText">
                  {{ t('wizard.includeEscapedText') }}
                </label>
              </div>
            </div>
            <XTombstoneBannerComponent
              :update-banner="updateBanner"
              :update-banner-background="updateBannerBackground"
              :update-banner-social-icons="updateBannerSocialIcons"
              :update-banner-show-text="updateBannerShowText"
            />
            <div class="mb-3">
              <div class="form-check">
                <input
                  id="updateBio"
                  v-model="updateBio"
                  type="checkbox"
                  class="form-check-input"
                />
                <label class="form-check-label" for="updateBio"
                  >{{ t('wizard.updateBioText') }}</label
                >
              </div>
              <div class="indent">
                <small class="form-text text-muted">
                  {{ t('wizard.bioDescription') }}
                </small>
              </div>
            </div>
            <div class="indent">
              <div class="mb-1">
                <label for="updateBioText" class="form-label visually-hidden"
                  >{{ t('wizard.bioText') }}</label
                >
                <textarea
                  id="updateBioText"
                  v-model="updateBioText"
                  class="form-control"
                  :class="{ 'form-error': bioCharactersLeft < 0 }"
                  rows="2"
                  :disabled="!updateBio"
                />
              </div>
              <div
                class="mb-3 text-end form-text small"
                :class="{
                  'text-danger': bioCharactersLeft < 0,
                  'text-muted': bioCharactersLeft >= 0,
                }"
              >
                {{ t('wizard.charactersOf', { current: bioCharacters, max: 160 }) }}
              </div>
              <p
                v-if="updateBio && bioCharactersLeft < 0"
                class="text-danger small"
              >
                {{ t('wizard.bioTooLong', { count: bioCharactersLeft * -1 }) }}
              </p>
              <div class="mb-3">
                <div class="form-check">
                  <input
                    id="updateBioCreditCyd"
                    v-model="updateBioCreditCyd"
                    type="checkbox"
                    class="form-check-input"
                    :disabled="!updateBio"
                  />
                  <label class="form-check-label" for="updateBioCreditCyd">
                    Link to Cyd's website in bio
                  </label>
                </div>
                <div class="indent">
                  <small class="form-text text-muted">
                    Add "(I escaped X using https://cyd.social)" to the end of
                    your bio. This uses
                    {{ tombstoneUpdateBioCreditCydText.length }}
                    characters, but is appreciated!
                  </small>
                </div>
              </div>
            </div>
            <div class="mb-3">
              <div class="form-check">
                <input
                  id="lockAccount"
                  v-model="lockAccount"
                  type="checkbox"
                  class="form-check-input"
                />
                <label class="form-check-label" for="lockAccount"
                  >Lock account</label
                >
              </div>
              <div class="indent">
                <small class="form-text text-muted">
                  Enable the "Protect your posts" feature, so only your
                  followers can see your posts.
                </small>
              </div>
            </div>
          </form>
        </div>
      </div>
    </template>
  </BaseWizardPage>
</template>

<style scoped>
textarea.form-error {
  border-color: #dc3545;
}
</style>
