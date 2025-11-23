<script setup lang="ts">
import { useI18n } from "vue-i18n";
import {
  TombstoneBannerBackground,
  TombstoneBannerSocialIcons,
} from "../../../types_x";

const { t } = useI18n();

defineProps<{
  updateBanner: boolean;
  updateBannerBackground: TombstoneBannerBackground;
  updateBannerSocialIcons: TombstoneBannerSocialIcons;
  updateBannerShowText: boolean;
}>();
</script>

<template>
  <div v-if="updateBanner" class="banner-preview-wrapper mb-3">
    <p class="text-center text-muted small mb-1">{{ t('tombstoneBanner.bannerPreview') }}</p>
    <div class="banner-preview">
      <!-- background -->
      <div
        v-if="updateBannerBackground == 'night'"
        class="banner-layer banner-bg-night"
      />
      <div
        v-if="updateBannerBackground == 'morning'"
        class="banner-layer banner-bg-morning"
      />
      <!-- foreground -->
      <div class="banner-layer banner-foreground" />
      <!-- text -->
      <div v-if="updateBannerShowText" class="banner-layer banner-text" />
      <!-- social icons -->
      <div
        v-if="updateBannerSocialIcons == 'bluesky'"
        class="banner-layer banner-social-bluesky"
      />
      <div
        v-if="updateBannerSocialIcons == 'mastodon'"
        class="banner-layer banner-social-mastodon"
      />
      <div
        v-if="updateBannerSocialIcons == 'bluesky-mastodon'"
        class="banner-layer banner-social-bluesky-mastodon"
      />
      <div
        v-if="updateBannerSocialIcons == 'mastodon-bluesky'"
        class="banner-layer banner-social-mastodon-bluesky"
      />
    </div>
  </div>
</template>

<style scoped>
.banner-preview {
  width: 100%;
  aspect-ratio: 3 / 1;
  position: relative;
}
.banner-preview > div {
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
  background-image: url("/assets/tombstone-bg-night.png");
}
.banner-preview .banner-bg-morning {
  background-image: url("/assets/tombstone-bg-morning.png");
}
.banner-preview .banner-foreground {
  background-image: url("/assets/tombstone-foreground.png");
}
.banner-preview .banner-text {
  background-image: url("/assets/tombstone-text.png");
}
.banner-preview .banner-social-bluesky {
  background-image: url("/assets/tombstone-social-bluesky.png");
}
.banner-preview .banner-social-mastodon {
  background-image: url("/assets/tombstone-social-mastodon.png");
}
.banner-preview .banner-social-bluesky-mastodon {
  background-image: url("/assets/tombstone-social-bluesky-mastodon.png");
}
.banner-preview .banner-social-mastodon-bluesky {
  background-image: url("/assets/tombstone-social-mastodon-bluesky.png");
}
</style>
