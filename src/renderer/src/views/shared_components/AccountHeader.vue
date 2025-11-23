<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { getAccountIcon } from "../../util";
import type { Account } from "../../../../shared_types";

const { t } = useI18n();

defineProps<{
  account: Account;
  showRefreshButton: boolean;
}>();

const emit = defineEmits(["onRefreshClicked", "onRemoveClicked"]);

const refreshBtnShowInfo = ref(false);
const onRefreshClicked = () => {
  emit("onRefreshClicked");
};

const removeBtnShowInfo = ref(false);
const onRemoveClicked = () => {
  emit("onRemoveClicked");
};
</script>

<template>
  <div class="account-header d-flex align-items-center justify-content-between">
    <div class="label d-flex align-items-center mx-auto">
      <template v-if="account.type == 'X'">
        <template
          v-if="
            account.xAccount?.profileImageDataURI != '' &&
            account.xAccount?.profileImageDataURI != null
          "
        >
          <span class="profile-image">
            <img
              :alt="t('common.profileImage')"
              :src="account.xAccount?.profileImageDataURI"
            />
          </span>
        </template>
        <template v-if="account.xAccount?.username != null">
          <span class="label-text">@{{ account.xAccount?.username }}</span>
        </template>
      </template>
      <span class="logo">
        <i :class="getAccountIcon(account.type)" />
      </span>
    </div>
    <div class="d-flex">
      <div v-if="showRefreshButton" class="btn-container">
        <div
          class="refresh-btn account-header-btn d-flex justify-content-center align-items-center"
          @mouseover="refreshBtnShowInfo = true"
          @mouseleave="refreshBtnShowInfo = false"
          @click="onRefreshClicked"
        >
          <i class="fa-solid fa-rotate" />
        </div>
        <div v-if="refreshBtnShowInfo" class="info-popup info-popup-refresh">
          {{ t('account.backToStart') }}
        </div>
      </div>
      <div class="btn-container">
        <div
          class="remove-btn account-header-btn d-flex justify-content-center align-items-center"
          @mouseover="removeBtnShowInfo = true"
          @mouseleave="removeBtnShowInfo = false"
          @click="onRemoveClicked"
        >
          <i class="fa-solid fa-trash" />
        </div>
        <div v-if="removeBtnShowInfo" class="info-popup info-popup-remove">
          {{ t('account.removeAccount') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.account-header {
  margin-left: -3px;
  margin-right: -12px;
  padding: 3px 10px;
  background-color: #3f5f8b;
  border-bottom: 3px solid #5885c4;
}

.btn-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.account-header-btn {
  width: 40px;
  height: 40px;
  font-size: 20px;
  border-radius: 30%;
  cursor: pointer;
  color: #ffffff;
  opacity: 0.5;
  border-radius: 50%;
}

.account-header-btn:hover {
  opacity: 1;
}

.label {
  color: #ffffff;
  font-size: 20px;
}

.label .logo {
  opacity: 0.5;
  margin-left: 10px;
}

.profile-image img {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  margin-right: 10px;
}

.info-popup {
  position: absolute;
  background-color: #000000;
  color: #ffffff;
  padding: 3px 6px;
  border-radius: 4px;
  white-space: nowrap;
  top: 35px;
  right: 0px;
}
</style>
