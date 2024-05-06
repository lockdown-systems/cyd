<script setup lang="ts">
import { Ref, ref, inject, computed } from 'vue';
import { useRouter } from 'vue-router';

import { Service } from "../models";
import ServiceCard from "../components/ServiceCard.vue"

const router = useRouter()

// const showError = inject('showError') as (message: string) => void;
// const getServices = inject('getServices') as () => void;
const services = inject('services') as Ref<Array<Service>>;

const editMode = ref(false);

function toggleEditMode() {
  editMode.value = !editMode.value;
}

const editButtonText = computed(() => {
  return editMode.value ? "Done" : "Edit"
})

const deleteService = async (index: number) => {
  console.log(`deleteService: ${index}`);
  // invoke("delete_service", { serviceId: services.value[index].id }).then(() => {
  //   getServices();
  // }).catch(error => {
  //   showError(`Failed to create new service: ${error}`);
  // });
};

const serviceClicked = async (index: number) => {
  let serviceId = services.value[index].id;
  router.push(`/service/${serviceId}`);
}
</script>

<template>
  <div class="container p-2 h-100">
    <!-- No services yet -->
    <template v-if="services.length == 0">
      <div class="d-flex align-items-center h-100">
        <div class="w-100">
          <div class="text-center">
            <img src="/logo.png" class="logo mb-3" alt="Semiphemeral Logo" style="width: 120px;" />
          </div>
          <p class="lead text-muted text-center">
            Automatically delete your old posts, except the ones you want to keep.
          </p>
          <p class="text-center">
            <router-link to="/new" class="btn btn-primary">Add First Service</router-link>
          </p>
          <p class="text-center">
            <router-link to="/test-webview" class="btn btn-primary">Test Webview</router-link>
          </p>
        </div>
      </div>
    </template>

    <!-- Display services -->
    <template v-else>
      <div class="text-center">
        <img src="/logo.png" class="logo mb-3" alt="Semiphemeral Logo" style="width: 120px;" />
      </div>
      <div class="actions d-flex justify-content-between">
        <router-link to="/new" class="btn btn-primary">
          <i class="bi bi-plus-lg"></i> Add
        </router-link>
        <button class="btn btn-secondary" @click="toggleEditMode">
          <i class="bi bi-pencil-square"></i> {{ editButtonText }}
        </button>
      </div>

      <div>
        <div v-for="(service, index) in services" :key="service.id" class="row mb-3 align-items-center">
          <div :class="editMode ? 'col' : 'col-12'">
            <ServiceCard :service="service" :isEditable="editMode" @click="serviceClicked(index)" />
          </div>
          <div v-if="editMode" class="col-auto">
            <button @click.stop="deleteService(index)" class="btn btn-danger btn-sm">
              Delete
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  justify-content: space-between;
  padding: 1em 0;
}
</style>
