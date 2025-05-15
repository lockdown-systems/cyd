<script setup lang="ts">
import { ref } from 'vue';
import { XViewModel, State } from '../../view_models/XViewModel'

// Props
defineProps<{
    model: XViewModel;
}>();

// Emits
defineEmits<{
    setState: [value: State]
}>()

// Buttons

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
// const updateBioCreditCyd = ref(true);
const lockAccount = ref(true);
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
                </div>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="lockAccount" v-model="lockAccount" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="lockAccount">Lock account</label>
                    </div>
                </div>
            </form>

            <div class="buttons mb-4">
                <p>todo: add buttons</p>
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
</style>
