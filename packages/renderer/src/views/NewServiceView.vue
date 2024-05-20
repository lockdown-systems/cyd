<script setup lang="ts">
// import { inject } from 'vue';
import { useRouter } from 'vue-router';

import { ServiceType } from "../models";
import NewServiceButton from "../components/NewServiceButton.vue"

const router = useRouter()

// const showError = inject('showError') as (message: string) => void;
// const getServices = inject('getServices') as () => void;

const addService = async (type: ServiceType) => {
  console.log(`addService: ${type}`);
  // invoke("new_service", { serviceType: type }).then(() => {
  //   getServices();
  //   router.push('/') // Redirect to Services
  // }).catch(error => {
  //   showError(`Failed to create new service: ${error}`);
  // });
};

const goBack = async () => {
  router.push('/') // Redirect to Services
};
</script>

<template>
  <div class="container p-2">
    <div class="row">
      <div class="col text-left">
        <button class="btn btn-secondary" @click="goBack">
          <i class="bi bi-arrow-left"></i> Back
        </button>
      </div>
    </div>
    <div class="text-center">
      <h1 class="mb-5">What service do you want to clean?</h1>
      <div class="row service-types">
        <NewServiceButton name="X" icon="/x-logo64.png"
          description="X, formerly Twitter, is a social media service owned by a billionaire man-baby"
          @click="addService(ServiceType.X)" />
        <NewServiceButton name="Reddit" icon="/reddit-logo64.png"
          description="Reddit is a social news aggregation platform and forum that sells all your data to AI companies"
          @click="addService(ServiceType.Reddit)" />
      </div>
    </div>
  </div>
</template>