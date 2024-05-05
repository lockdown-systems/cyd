<script setup lang="ts">
import { ref, onMounted, provide } from "vue"
import { Service } from "./models";
import ErrorMessage from './components/ErrorMessage.vue';

// Error messages
const showErrorModal = ref(false);
const errorMessage = ref('');

// const infoMessage = ref("");

provide('showError', (message: string) => {
  errorMessage.value = message;
  showErrorModal.value = true;
});

provide('hideError', () => {
  errorMessage.value = '';
  showErrorModal.value = false;
});

// Services
const services = ref<Service[]>([]);
const getServices = async () => {
  // invoke("get_services").then((data) => {
  //   services.value = data as Service[];
  // }).catch(error => {
  //   console.error('Failed to load services:', error);
  // });
}
provide('services', services);
provide('getServices', getServices);

onMounted(() => {
  getServices();
  // infoMessage.value = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`;
});
</script>

<template>
  <Suspense>
    <template #default>
      <div class="h-100">
        <router-view></router-view>
        <ErrorMessage v-if="showErrorModal" :message="errorMessage" @close="showErrorModal = false" />
      </div>
    </template>
    <template #fallback>
      <div class="container mt-5">
        <div class="text-center mb-4">
          <img src="/logo.png" class="logo mb-3" alt="Semiphemeral Logo" style="width: 120px;" />
        </div>
        <p class="lead text-muted text-center">
          Automatically delete your old posts, except the ones you want to keep.
        </p>
        <p id="versions"></p>
      </div>
    </template>
  </Suspense>
</template>

<style>
html,
body {
  height: 100%;
  margin: 0;
  padding: 0;
}

#app {
  height: 100%;
}

.modal-backdrop.show {
  display: none;
}

.modal.show {
  display: block;
  background-color: rgba(0, 0, 0, 0.5);
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1050;
}
</style>