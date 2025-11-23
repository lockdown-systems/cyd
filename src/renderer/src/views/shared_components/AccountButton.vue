<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { getAccountIcon } from "../../util";
import type { Account } from "../../../../shared_types";

const { t } = useI18n();

const props = defineProps<{
  account: Account;
  active: boolean;
}>();

const emit = defineEmits(["onRemoveClicked"]);

const showInfo = ref(false);
const showMenu = ref(false);
const menuBtnEl = ref<HTMLDivElement | null>(null);
const menuPopupEl = ref<HTMLDivElement | null>(null);

const removeClicked = () => {
  showMenu.value = false;
  emit("onRemoveClicked");
};

const menuAuxClicked = () => {
  showMenu.value = !showMenu.value;
};

const outsideMenuClicked = (event: MouseEvent) => {
  setTimeout(() => {
    if (
      showMenu.value &&
      !menuBtnEl.value?.contains(event.target as Node) &&
      !menuPopupEl.value?.contains(event.target as Node)
    ) {
      showMenu.value = false;
    }
  }, 100);
};

onMounted(async () => {
  document.addEventListener("click", outsideMenuClicked);
  document.addEventListener("auxclick", outsideMenuClicked);
});

onUnmounted(async () => {
  document.removeEventListener("click", outsideMenuClicked);
  document.removeEventListener("auxclick", outsideMenuClicked);
});
</script>

<template>
  <div class="btn-container" :class="{ active: active }">
    <div
      ref="menuBtnEl"
      class="account-btn d-flex justify-content-center align-items-center"
      @mouseover="showInfo = true"
      @mouseleave="showInfo = false"
      @auxclick="menuAuxClicked"
    >
      <template v-if="props.account.type == 'X'">
        <img
          v-if="
            props.account.xAccount?.profileImageDataURI != '' &&
            props.account.xAccount?.profileImageDataURI != null
          "
          :src="props.account.xAccount?.profileImageDataURI"
        />
        <i v-else :class="getAccountIcon(account.type)" />
      </template>
      <template v-else-if="props.account.type == 'Facebook'">
        <img
          v-if="
            props.account.facebookAccount?.profileImageDataURI != '' &&
            props.account.facebookAccount?.profileImageDataURI != null
          "
          :src="props.account.facebookAccount?.profileImageDataURI"
        />
        <i v-else :class="getAccountIcon(account.type)" />
      </template>
      <i v-else :class="getAccountIcon(account.type)" />
    </div>
    <div v-if="showInfo" class="info-popup">
      <template v-if="props.account.type == 'unknown'">
        Add a new account
      </template>
      <template v-else-if="props.account.type == 'X'">
        <template v-if="props.account.xAccount?.username == null">
          Login to your X account
        </template>
        <template v-else>
          <i :class="getAccountIcon(account.type)" />
          @{{ props.account.xAccount?.username }}
        </template>
      </template>
      <template v-else-if="props.account.type == 'Facebook'">
        <template v-if="props.account.facebookAccount?.accountID == null">
          Login to your Facebook account
        </template>
        <template v-else>
          <i :class="getAccountIcon(account.type)" />
          {{ props.account.facebookAccount?.name }}
        </template>
      </template>
    </div>
    <div v-if="showMenu" ref="menuPopupEl" class="menu-popup">
      <ul>
        <li class="menu-btn remove-button" @click="removeClicked">{{ t('accountButton.remove') }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.btn-container .account-btn {
  opacity: 0.5;
}

.btn-container.active .account-btn {
  opacity: 1;
}

.account-btn {
  width: 40px;
  height: 40px;
  font-size: 25px;
  border-radius: 30%;
  cursor: pointer;
  color: white;
  background-color: black;
}

.account-btn img {
  width: 100%;
  height: 100%;
  border-radius: 30%;
}

.info-popup {
  bottom: 4px;
  left: 45px;
}

.menu-popup {
  top: 4px;
  left: 45px;
}
</style>
