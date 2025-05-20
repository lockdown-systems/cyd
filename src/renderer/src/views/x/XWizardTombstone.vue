<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { XViewModel, State, tombstoneUpdateBioCreditCydText } from '../../view_models/XViewModel'
import { setJobsType } from '../../util'
import { TombstoneBannerBackground, TombstoneBannerSocialIcons } from '../../types_x';

import XTombstoneBannerComponent from './XTombstoneBannerComponent.vue';

// Props
const props = defineProps<{
    model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
    updateAccount: []
    setState: [value: State]
}>()

// Buttons
const nextClicked = async () => {
    await saveSettings();
    setJobsType(props.model.account.id, 'tombstone');
    emit('setState', State.WizardReview);
};

// Settings
const updateBanner = ref(true);
const updateBannerBackground = ref<TombstoneBannerBackground>(TombstoneBannerBackground.Night);
const updateBannerSocialIcons = ref<TombstoneBannerSocialIcons>(TombstoneBannerSocialIcons.None);
const updateBannerShowText = ref(true);
const updateBio = ref(true);
const updateBioText = ref('');
const updateBioCreditCyd = ref(true);
const lockAccount = ref(true);

const loadSettings = async () => {
    console.log('XWizardTombstone', 'loadSettings');
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.xAccount) {
        updateBanner.value = account.xAccount.tombstoneUpdateBanner;
        if (account.xAccount.tombstoneUpdateBannerBackground == 'morning') {
            updateBannerBackground.value = TombstoneBannerBackground.Morning;
        } else {
            // default to night
            updateBannerBackground.value = TombstoneBannerBackground.Night;
        }
        if (account.xAccount.tombstoneUpdateBannerSocialIcons == 'bluesky') {
            updateBannerSocialIcons.value = TombstoneBannerSocialIcons.Bluesky;
        } else if (account.xAccount.tombstoneUpdateBannerSocialIcons == 'mastodon') {
            updateBannerSocialIcons.value = TombstoneBannerSocialIcons.Mastodon;
        } else if (account.xAccount.tombstoneUpdateBannerSocialIcons == 'bluesky-mastodon') {
            updateBannerSocialIcons.value = TombstoneBannerSocialIcons.BlueskyMastodon;
        } else if (account.xAccount.tombstoneUpdateBannerSocialIcons == 'mastodon-bluesky') {
            updateBannerSocialIcons.value = TombstoneBannerSocialIcons.MastodonBluesky;
        } else {
            // default to none
            updateBannerSocialIcons.value = TombstoneBannerSocialIcons.None;
        }
        updateBannerShowText.value = account.xAccount.tombstoneUpdateBannerShowText;
        updateBio.value = account.xAccount.tombstoneUpdateBio;
        updateBioCreditCyd.value = account.xAccount.tombstoneUpdateBioCreditCyd;
        lockAccount.value = account.xAccount.tombstoneLockAccount;

        // Pull bio text what's in their X profile, not their tombstone bio text
        updateBioText.value = account.xAccount.bio ? account.xAccount.bio : '';
    }
};

const loadImage = async (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

const imageToCanvas = async (img: HTMLImageElement): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return canvas;
}

const mergeCanvases = async (bgCanvas: HTMLCanvasElement, fgCanvas: HTMLCanvasElement): Promise<HTMLCanvasElement> => {
    const width = Math.max(bgCanvas.width, fgCanvas.width);
    const height = Math.max(bgCanvas.height, fgCanvas.height);
    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = width;
    mergedCanvas.height = height;
    const ctx = mergedCanvas.getContext('2d')!;
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.drawImage(fgCanvas, 0, 0);
    return mergedCanvas;
}

const buildBannerImage = async (): Promise<string> => {
    if(!updateBanner.value) {
        return "";
    }

    // Background
    let bgUrl: string;
    if(updateBannerBackground.value == TombstoneBannerBackground.Night) {
        bgUrl = '/assets/tombstone-bg-night.png';
    } else {
        bgUrl = '/assets/tombstone-bg-morning.png';
    }
    const bgImg = await loadImage(bgUrl);
    const bgCanvas = await imageToCanvas(bgImg);

    // Foreground
    const fgImg = await loadImage('/assets/tombstone-foreground.png');
    const fgCanvas = await imageToCanvas(fgImg);

    // Merged background and foreground
    let bannerCanvas = await mergeCanvases(bgCanvas, fgCanvas);

    // Is there a text layer?
    if (updateBannerShowText.value) {
        const textImg = await loadImage('/assets/tombstone-text.png');
        const textCanvas = await imageToCanvas(textImg);

        bannerCanvas = await mergeCanvases(bannerCanvas, textCanvas);
    }

    // Is there a social icon layer?
    if(updateBannerSocialIcons.value != TombstoneBannerSocialIcons.None) {
        let socialUrl: string;
        switch(updateBannerSocialIcons.value) {
            case TombstoneBannerSocialIcons.Bluesky:
                socialUrl = '/assets/tombstone-social-bluesky.png';
                break;
            case TombstoneBannerSocialIcons.Mastodon:
                socialUrl = '/assets/tombstone-social-mastodon.png';
                break;
            case TombstoneBannerSocialIcons.BlueskyMastodon:
                socialUrl = '/assets/tombstone-social-bluesky-mastodon.png';
                break;
            case TombstoneBannerSocialIcons.MastodonBluesky:
                socialUrl = '/assets/tombstone-social-mastodon-bluesky.png';
                break;
        }
        const socialImg = await loadImage(socialUrl);
        const socialCanvas = await imageToCanvas(socialImg);

        bannerCanvas = await mergeCanvases(bannerCanvas, socialCanvas);
    }

    return bannerCanvas.toDataURL('image/png');
}

const saveSettings = async () => {
    console.log('XWizardTombstone', 'saveSettings');
    if (!props.model.account) {
        console.error('XWizardTombstone', 'saveSettings', 'account is null');
        return;
    }

    const bannerDataURL = await buildBannerImage();

    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.xAccount) {
        account.xAccount.tombstoneUpdateBanner = updateBanner.value;
        account.xAccount.tombstoneUpdateBannerBackground = updateBannerBackground.value;
        account.xAccount.tombstoneUpdateBannerSocialIcons = updateBannerSocialIcons.value;
        account.xAccount.tombstoneUpdateBannerShowText = updateBannerShowText.value;
        account.xAccount.tombstoneBannerDataURL = bannerDataURL;
        account.xAccount.tombstoneUpdateBio = updateBio.value;
        account.xAccount.tombstoneUpdateBioText = updateBioText.value;
        account.xAccount.tombstoneUpdateBioCreditCyd = updateBioCreditCyd.value;
        account.xAccount.tombstoneLockAccount = lockAccount.value;

        await window.electron.database.saveAccount(JSON.stringify(account));
        emit('updateAccount');
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
        return 160 - tombstoneUpdateBioCreditCydText.length - updateBioText.value.length;
    } else {
        return 160 - updateBioText.value.length;
    }
});

onMounted(async () => {
    console.log('XWizardTombstone', 'onMounted');
    await loadSettings();
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Hello, darkness, my old friend
            </h2>
            <p class="text-muted">
                It's time to move on from X. How can I help you?
            </p>

            <form @submit.prevent>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="updateBanner" v-model="updateBanner" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="updateBanner">Update profile banner</label>
                    </div>
                    <div class="indent">
                        <small class="form-text text-muted">
                            Customize the background, show Bluesky or Mastodon icons, and include text about how you
                            escaped.
                        </small>
                    </div>
                </div>
                <div class="indent">
                    <div class="mb-1 d-flex align-items-center">
                        <label class="form-check-label me-2 text-nowrap" for="updateBannerBackground">
                            Background
                        </label>
                        <select id="updateBannerBackground" v-model="updateBannerBackground" class="form-select w-auto"
                            aria-label="Background" :disabled="!updateBanner">
                            <option value="night">
                                Night
                            </option>
                            <option value="morning">
                                Morning
                            </option>
                        </select>
                    </div>
                    <div class="mb-1 d-flex align-items-center">
                        <label class="form-check-label me-2 text-nowrap" for="updateBannerSocialIcons">
                            Social icons
                        </label>
                        <select id="updateBannerSocialIcons" v-model="updateBannerSocialIcons"
                            class="form-select w-auto" aria-label="Social icons" :disabled="!updateBanner">
                            <option value="none">
                                None
                            </option>
                            <option value="bluesky">
                                Bluesky
                            </option>
                            <option value="mastodon">
                                Mastodon
                            </option>
                            <option value="bluesky-mastodon">
                                Bluesky (left) and Mastodon (right)
                            </option>
                            <option value="mastodon-bluesky">
                                Mastodon (left) and Bluesky (right)
                            </option>
                        </select>
                    </div>
                    <div class="mb-3 form-check">
                        <input id="updateBannerShowText" v-model="updateBannerShowText" type="checkbox"
                            class="form-check-input" :disabled="!updateBanner">
                        <label class="form-check-label" for="updateBannerShowText">
                            Include "I escaped from X/Twitter" text
                        </label>
                    </div>
                </div>
                <XTombstoneBannerComponent :update-banner="updateBanner"
                    :update-banner-background="updateBannerBackground"
                    :update-banner-social-icons="updateBannerSocialIcons"
                    :update-banner-show-text="updateBannerShowText" />
                <div class="mb-3">
                    <div class="form-check">
                        <input id="updateBio" v-model="updateBio" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="updateBio">Update bio text</label>
                    </div>
                    <div class="indent">
                        <small class="form-text text-muted">
                            Make sure your new bio text tells your followers that you are leaving X, and where to find
                            you now.
                        </small>
                    </div>
                </div>
                <div class="indent">
                    <div class="mb-1">
                        <label for="updateBioText" class="form-label visually-hidden">Bio text</label>
                        <textarea id="updateBioText" v-model="updateBioText" class="form-control"
                            :class="{ 'form-error': bioCharactersLeft < 0 }" rows="2" :disabled="!updateBio" />
                    </div>
                    <div class="mb-3 text-end form-text small"
                        :class="{ 'text-danger': bioCharactersLeft < 0, 'text-muted': bioCharactersLeft >= 0 }">
                        {{ bioCharacters }} of 160 characters
                    </div>
                    <div class="mb-3">
                        <div class="form-check">
                            <input id="updateBioCreditCyd" v-model="updateBioCreditCyd" type="checkbox"
                                class="form-check-input" :disabled="!updateBio">
                            <label class="form-check-label" for="updateBioCreditCyd">
                                Link to Cyd's website in bio
                            </label>
                        </div>
                        <div class="indent">
                            <small class="form-text text-muted">
                                Add "(I escaped X using https://cyd.social)" to the end of your bio. This uses {{
                                    tombstoneUpdateBioCreditCydText.length }}
                                characters, but is appreciated!
                            </small>
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="lockAccount" v-model="lockAccount" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="lockAccount">Lock account</label>
                    </div>
                    <div class="indent">
                        <small class="form-text text-muted">
                            Enable the "Protect your posts" feature, so only your followers can see your posts.
                        </small>
                    </div>
                </div>
            </form>

            <div class="buttons mb-4">
                <button type="submit" class="btn btn-primary text-nowrap m-1"
                    :disabled="!(updateBanner || updateBio || lockAccount) || (updateBio && bioCharactersLeft < 0)"
                    @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    <template v-if="updateBanner && updateBio && lockAccount">
                        Update My Banner and Bio, and Lock My Account
                    </template>
                    <template v-else-if="updateBanner && updateBio">
                        Update My Banner and Bio
                    </template>
                    <template v-else-if="updateBanner && lockAccount">
                        Update My Banner and Lock My Account
                    </template>
                    <template v-else-if="updateBio && lockAccount">
                        Update My Bio and Lock My Account
                    </template>
                    <template v-else-if="updateBanner">
                        Update My Banner
                    </template>
                    <template v-else-if="updateBio">
                        Update My Bio
                    </template>
                    <template v-else-if="lockAccount">
                        Lock My Account
                    </template>
                    <template v-else>
                        Select a Checkbox Above to Continue
                    </template>
                </button>

                <p v-if="updateBio && bioCharactersLeft < 0" class="text-danger small">
                    Your bio is {{ bioCharactersLeft * -1 }} characters too long
                </p>
            </div>
        </div>
    </div>
</template>

<style scoped>
textarea.form-error {
    border-color: #dc3545;
}
</style>
