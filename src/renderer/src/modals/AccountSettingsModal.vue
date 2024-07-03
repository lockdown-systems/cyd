<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getAccountIcon } from '../helpers';
import Modal from 'bootstrap/js/dist/modal';
import type { Account } from '../../../shared_types';

defineProps<{
    account: Account | null;
}>();

const emit = defineEmits(['hide']);
const hide = () => {
    emit('hide');
};

const accountSettingsModal = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

onMounted(async () => {
    const modalElement = accountSettingsModal.value;
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
    if (accountSettingsModal.value && modalInstance) {
        accountSettingsModal.value.removeEventListener('hidden.bs.modal', hide);
    }
});
</script>

<template>
    <div ref="accountSettingsModal" class="modal fade" role="dialog" aria-labelledby="accountSettingsModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-lg modal-xl modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title">
                        <i :class="getAccountIcon(account?.type || '')" />
                        <span>Settings: </span>
                        <template v-if="account?.type == 'X'">
                            <span v-if="account?.xAccount?.username != ''">@{{ account?.xAccount?.username }}</span>
                            <span v-else>not logged in</span>
                        </template>
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" @click="hide" />
                </div>
                <div class="modal-body">
                    <p>
                        Account settings coming soon...
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped></style>