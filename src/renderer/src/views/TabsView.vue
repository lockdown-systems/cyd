<script setup lang="ts">
import { inject, Ref, ref } from 'vue';
import type { DeviceInfo } from '../types';

const addServiceBtnShowInfo = ref(false);
const userBtnShowInfo = ref(false);

const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;
</script>

<template>
  <div class="container-fluid">
    <div class="row">
      <div class="sidebar col-auto d-flex flex-column gap-2">
        <div class="services-list flex-grow-1 d-flex flex-column mt-3">
        </div>

        <div class="btns-list d-flex flex-column gap-2 mb-3">
          <div class="btn-container">
            <div class="add-service-btn sidebar-btn d-flex justify-content-center align-items-center"
              @mouseover="addServiceBtnShowInfo = true" @mouseleave="addServiceBtnShowInfo = false">
              <i class="fa-solid fa-plus" />
            </div>
            <div v-if="addServiceBtnShowInfo" class="info-popup">
              Add a service
            </div>
          </div>

          <div class="btn-container">
            <div class="user-btn sidebar-btn d-flex justify-content-center align-items-center"
              @mouseover="userBtnShowInfo = true" @mouseleave="userBtnShowInfo = false">
              <i class="fa-solid fa-user-ninja" />
            </div>
            <div v-if="userBtnShowInfo" class="info-popup">
              You are logged in as {{ deviceInfo?.userEmail }}
            </div>
          </div>
        </div>
      </div>

      <div class="col" />
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  height: 100vh;
  width: 66px;
  background-color: #254a5b;
  border-right: 3px solid #5b9bb9;
}

.sidebar .btn-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sidebar .sidebar-btn {
  width: 40px;
  height: 40px;
  font-size: 25px;
  border-radius: 30%;
  cursor: pointer;
}

.sidebar .add-service-btn {
  color: #ffffff;
  background-color: #000000;
  opacity: 0.3;
  border-radius: 50%;
}

.sidebar .add-service-btn:hover {
  opacity: 0.6;
}

.sidebar .user-btn {
  color: #000000;
  background-color: #ffffff;
  opacity: 0.6;
}

.sidebar .user-btn:hover {
  opacity: 0.9;
}

.info-popup {
  position: absolute;
  bottom: 4px;
  left: 45px;
  background-color: #000000;
  color: #ffffff;
  padding: 3px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
</style>