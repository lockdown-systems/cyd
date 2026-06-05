<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { getAccountIcon } from "../util";
import type { Account } from "../../../shared_types";

import { getAccountRunning, setAccountRunning } from "../util";

import CydAvatarComponent from "./shared_components/CydAvatarComponent.vue";

import XView from "./x/XView.vue";
import FacebookView from "./facebook/FacebookView.vue";

const { t } = useI18n();

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits<{
  accountSelected: [account: Account, accountType: string];
  onRemoveClicked: [];
}>();

// Feature flags
const blueskyFeature = ref(false);
const facebookFeature = ref(false);

const isRefreshing = ref(false);

const refresh = async () => {
  await setAccountRunning(props.account.id, false);
  isRefreshing.value = true;
  setTimeout(() => {
    isRefreshing.value = false;
  }, 1);
};

const accountClicked = (accountType: string) => {
  emit("accountSelected", props.account, accountType);
};

onMounted(async () => {
  blueskyFeature.value = await window.electron.isFeatureEnabled("bluesky");
  facebookFeature.value = await window.electron.isFeatureEnabled("bluesky");

  // Check if this account was already running and got interrupted
  if (await getAccountRunning(props.account.id)) {
    console.error("Account was running and got interrupted");
    await setAccountRunning(props.account.id, false);
  }
});
</script>

<template>
  <div v-if="!isRefreshing">
    <template v-if="account.type == 'unknown'">
      <div class="container mt-5">
        <div class="text-center mb-3">
          <CydAvatarComponent :height="200" />
        </div>
        <p class="lead">
          {{ t("common.withCydDescription") }}
          <img
            src="/assets/wordmark.svg"
            class="cyd-wordmark"
            :alt="t('common.cyd')"
          />,
          {{ t("common.withCydDescriptionRest") }}
        </p>
        <p class="lead fw-bold">{{ t("common.readyToGetStarted") }}</p>

        <div class="select-account row">
          <div class="col-12 col-md-6">
            <div class="card m-2 select-account-x" @click="accountClicked('X')">
              <div class="card-body d-flex align-items-center">
                <div class="logo mr-3">
                  <i :class="getAccountIcon('X')" />
                </div>
                <div class="description">
                  <div class="name">X</div>
                  <small class="info text-muted">
                    {{ t("account.xDescription") }}
                  </small>
                </div>
              </div>
            </div>
          </div>

          <div v-if="blueskyFeature" class="col-12 col-md-6">
            <div
              class="card m-2 select-account-bluesky"
              @click="accountClicked('Bluesky')"
            >
              <div class="card-body d-flex align-items-center">
                <div class="logo mr-3">
                  <i :class="getAccountIcon('Bluesky')" />
                </div>
                <div class="description">
                  <div class="name">
                    Bluesky
                    <span class="alpha badge badge-primary">{{
                      t("common.alpha")
                    }}</span>
                  </div>
                  <small class="info text-muted">
                    {{ t("account.blueskyDescription") }}
                  </small>
                </div>
              </div>
            </div>
          </div>

          <div v-if="facebookFeature" class="col-12 col-md-6">
            <div
              class="card m-2 select-account-facebook"
              @click="accountClicked('Facebook')"
            >
              <div class="card-body d-flex align-items-center">
                <div class="logo mr-3">
                  <i :class="getAccountIcon('Facebook')" />
                </div>
                <div class="description">
                  <div class="name">Facebook</div>
                  <small class="info text-muted">
                    {{ t("account.facebookDescription") }}
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4">
          <p
            class="text-muted"
            v-html="t('account.facebookDevelopmentNote')"
          ></p>
        </div>
      </div>

      <!-- Cyd Mobile Promo -->
      <div class="mobile-promo">
        <div class="mobile-promo-content">
          <div class="mobile-promo-text">
            <h5 v-html="t('account.blueskyMobilePromo')"></h5>
            <p>
              <a
                href="https://cyd.social/docs/mobile/download"
                target="_blank"
                >{{ t("account.downloadMobileApp") }}</a
              >
            </p>
          </div>
          <div class="mobile-promo-image">
            <img
              src="/assets/cyd-mobile-screenshot.png"
              alt="Cyd Mobile App"
              class="mobile-screenshot"
            />
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="account.type == 'X'">
      <XView
        :account="account"
        @on-refresh-clicked="refresh"
        @on-remove-clicked="emit('onRemoveClicked')"
      />
    </template>

    <template v-else-if="account.type == 'Facebook'">
      <FacebookView
        :account="account"
        @on-refresh-clicked="refresh"
        @on-remove-clicked="emit('onRemoveClicked')"
      />
    </template>

    <template v-else>
      <p>{{ t("common.unknownAccountType") }}</p>
    </template>
  </div>
</template>

<style scoped>
.cyd-avatar {
  width: 150px;
}

.cyd-wordmark {
  height: 1em;
}

.card:hover {
  cursor: pointer;
  background-color: #e8f7ff;
}

.select-account .logo {
  font-size: 3rem;
  background-color: #e0e0e0;
  border-radius: 20%;
  padding: 0 0.8rem;
}

.select-account .description .name {
  font-size: 1.2rem;
  font-weight: bold;
}

/* Mobile Promo Styles */
.mobile-promo {
  position: fixed;
  bottom: 10px;
  right: 10px;
  z-index: 100;
  max-width: 500px;
}

.mobile-promo-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: linear-gradient(135deg, #e8f7ff 0%, #f0f9ff 100%);
  padding: 1.5rem;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transform: rotate(-1deg);
  transition: transform 0.3s ease;
  overflow: hidden;
}

.mobile-promo-content:hover {
  transform: rotate(0deg) translateY(-4px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
}

.mobile-promo-text {
  flex: 1;
}

.mobile-promo-text h5 {
  font-size: 1rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.mobile-promo-text p {
  margin: 0;
  font-size: 0.95rem;
}

.mobile-promo-text a {
  color: #0066cc;
  text-decoration: none;
  font-weight: 600;
}

.mobile-promo-text a:hover {
  text-decoration: underline;
}

.mobile-promo-image {
  margin-top: -10px;
  margin-bottom: -40px;
}

.mobile-screenshot {
  width: 150px;
  height: auto;
  border-radius: 8px;
  transform: rotate(3deg);
  transition: transform 0.3s ease;
}

.mobile-promo-content:hover .mobile-screenshot {
  transform: rotate(0deg);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .mobile-promo {
    position: static;
    max-width: 100%;
    margin-top: 2rem;
  }

  .mobile-promo-content {
    transform: none;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .mobile-screenshot {
    width: 150px;
    transform: none;
  }

  .mobile-promo-content:hover {
    transform: none;
  }

  .mobile-promo-content:hover .mobile-screenshot {
    transform: none;
  }
}

@media (max-width: 1024px) and (min-width: 769px) {
  .mobile-promo {
    max-width: 380px;
  }

  .mobile-screenshot {
    width: 130px;
  }

  .mobile-promo-text h5 {
    font-size: 0.9rem;
  }

  .mobile-promo-text p {
    font-size: 0.85rem;
  }
}
</style>
