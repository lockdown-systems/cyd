<script setup lang="ts">
import { inject, ref, Ref, onMounted, onUnmounted } from 'vue';
import Modal from 'bootstrap/js/dist/modal';
import moment from 'moment';

import { SemiphemeralAPIClient } from 'semiphemeral-api-client';
import type { DeviceInfo, GetDevicesApiResponse } from '../types';

const emit = defineEmits(['hide']);
const hide = () => {
  emit('hide');
};

const settingsModal = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;
const refreshDeviceInfo = inject('refreshDeviceInfo') as () => Promise<void>;
const apiClient = inject('apiClient') as Ref<SemiphemeralAPIClient>;

const devices = ref<GetDevicesApiResponse[]>([]);

const platforms: { [key: string]: string } = {
  'macOS': 'fa-brands fa-apple',
  'Windows': 'fa-brands fa-windows',
  'Linux': 'fa-brands fa-linux'
};

const getPlatformIcon = (description: string): string => {
  for (const platform in platforms) {
    if (description.startsWith(`${platform}: `)) {
      return platforms[platform];
    }
  }
  return 'fa-regular fa-circle-question';
}

const formatDescription = (description: string) => {
  for (const platform in platforms) {
    if (description.startsWith(`${platform}: `)) {
      return description.slice(platform.length + 2);
    }
  }
  return description;
}

const relativeTime = (timestamp: Date) => {
  return moment(timestamp).fromNow();
}

const revokeDevice = async (uuid: string) => {
  console.log('Revoking device with UUID:', uuid);
  await apiClient.value.deleteDevice({
    uuid: uuid
  });
  await getDevices();
}

const revokeAll = async () => {
  for (const device of devices.value) {
    if (device.uuid !== deviceInfo.value?.deviceUUID) {
      revokeDevice(device.uuid);
    }
  }
  await getDevices();
}

const getDevices = async () => {
  const resp = await apiClient.value.getDevices();
  if ("error" in resp && resp.error) {
    window.electron.showError(resp.message);
    return;
  }
  if ("devices" in resp) {
    devices.value = resp.devices;
  }
}

onMounted(async () => {
  if (!deviceInfo.value) {
    await refreshDeviceInfo();
  }
  await getDevices();

  const modalElement = settingsModal.value;
  if (modalElement) {
    modalInstance = new Modal(modalElement);
    modalInstance.show();

    // The 'hidden.bs.modal' event is triggered when when the user clicks outside the modal
    modalElement.addEventListener('hidden.bs.modal', () => {
      hide();
    });
  }
});

onUnmounted(() => {
  if (settingsModal.value && modalInstance) {
    settingsModal.value.removeEventListener('hidden.bs.modal', hide);
  }
});
</script>

<template>
  <div id="settingsModal" ref="settingsModal" class="modal fade" role="dialog" aria-labelledby="settingsModalLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-lg modal-xl modal-dialog-centered" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h4 class="modal-title">
            Settings
          </h4>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" @click="hide" />
        </div>
        <div class="modal-body">
          <div v-if="devices.length === 0">
            <p>No devices found. This should never happen, since you're using a device right now.</p>
          </div>
          <div v-else>
            <h2>Active devices</h2>
            <div class="d-flex flex-wrap">
              <div v-for="device in devices" :key="device.uuid" class="card m-2" style="width: 18rem;">
                <div class="card-body">
                  <h5 class="card-title">
                    <i :class="getPlatformIcon(device.description)" />
                    {{ formatDescription(device.description) }}
                  </h5>
                  <template v-if="deviceInfo?.deviceUUID == device.uuid">
                    <h6 class="card-subtitle mb-2 text-muted">
                      you are currently using this device
                    </h6>
                  </template>
                  <template v-else>
                    <h6 class="card-subtitle mb-2 text-muted">
                      last accessed {{
                        relativeTime(device.last_accessed_at) }}
                    </h6>
                    <button class="btn btn-danger" @click="revokeDevice(device.uuid)">
                      Revoke
                    </button>
                  </template>
                </div>
              </div>
            </div>
            <div v-if="devices.length > 1" class="m-2">
              <button class="btn btn-danger btn-sm" @click="revokeAll">
                Revoke All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>