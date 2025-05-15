<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { XViewModel, State } from '../../view_models/XViewModel'
import { setJobsType } from '../../util'

// Props
const props = defineProps<{
    model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
}>()

// Buttons
const nextClicked = async () => {
    setJobsType(props.model.account.id, 'tombstone');
    emit('setState', State.WizardReview);
};

// Settings
enum BannerBackground {
    Night = 'night',
    Morning = 'morning',
}

enum BannerSocialIcons {
    None = 'none',
    Bluesky = 'bluesky',
    Mastodon = 'mastodon',
    BlueskyMastodon = 'bluesky-mastodon',
    MastodonBluesky = 'mastodon-bluesky',
}

const updateBanner = ref(true);
const updateBannerBackground = ref<BannerBackground>(BannerBackground.Night);
const updateBannerSocialIcons = ref<BannerSocialIcons>(BannerSocialIcons.None);
const updateBannerShowText = ref(true);
const updateBio = ref(true);
const updateBioText = ref('');
const updateBioCreditCyd = ref(true);
const lockAccount = ref(true);

const bioCharacters = computed(() => {
    if (updateBioCreditCyd.value) {
        return 39 + updateBioText.value.length;
    } else {
        return updateBioText.value.length;
    }
});

const bioCharactersLeft = computed(() => {
    if (updateBioCreditCyd.value) {
        return 160 - 39 - updateBioText.value.length;
    } else {
        return 160 - updateBioText.value.length;
    }
});

onMounted(() => {
    console.log('XWizardTombstone', 'onMounted');
    updateBioText.value = props.model.account.xAccount?.bio ? props.model.account.xAccount.bio : '';
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
                        <label class="form-check-label" for="updateBanner">Update the banner on my X profile</label>
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
                <div v-if="updateBanner" class="banner-preview-wrapper mb-3">
                    <p class="text-center text-muted small mb-1">
                        Banner Preview
                    </p>
                    <div class="banner-preview">
                        <!-- background -->
                        <div v-if="updateBannerBackground == 'night'" class="banner-layer banner-bg-night" />
                        <div v-if="updateBannerBackground == 'morning'" class="banner-layer banner-bg-morning" />
                        <!-- foreground -->
                        <div class="banner-layer banner-foreground" />
                        <!-- text -->
                        <div v-if="updateBannerShowText" class="banner-layer banner-text" />
                        <!-- social icons -->
                        <div v-if="updateBannerSocialIcons == 'bluesky'" class="banner-layer banner-social-bluesky" />
                        <div v-if="updateBannerSocialIcons == 'mastodon'" class="banner-layer banner-social-mastodon" />
                        <div v-if="updateBannerSocialIcons == 'bluesky-mastodon'"
                            class="banner-layer banner-social-bluesky-mastodon" />
                        <div v-if="updateBannerSocialIcons == 'mastodon-bluesky'"
                            class="banner-layer banner-social-mastodon-bluesky" />
                    </div>
                </div>
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
                                Add "(I escaped X using https://cyd.social)" to the end of your bio. This uses 39
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
.banner-preview {
    width: 100%;
    aspect-ratio: 3 / 1;
    position: relative;
}

.banner-preview>div {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.banner-preview .banner-layer {
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
}

.banner-preview .banner-bg-night {
    background-image: url('/assets/tombstone-bg-night.png');
}

.banner-preview .banner-bg-morning {
    background-image: url('/assets/tombstone-bg-morning.png');
}

.banner-preview .banner-foreground {
    background-image: url('/assets/tombstone-foreground.png');
}

.banner-preview .banner-text {
    background-image: url('/assets/tombstone-text.png');
}

.banner-preview .banner-social-bluesky {
    background-image: url('/assets/tombstone-social-bluesky.png');
}

.banner-preview .banner-social-mastodon {
    background-image: url('/assets/tombstone-social-mastodon.png');
}

.banner-preview .banner-social-bluesky-mastodon {
    background-image: url('/assets/tombstone-social-bluesky-mastodon.png');
}

.banner-preview .banner-social-mastodon-bluesky {
    background-image: url('/assets/tombstone-social-mastodon-bluesky.png');
}

textarea.form-error {
    border-color: #dc3545;
}
</style>
