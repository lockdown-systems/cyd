<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import Modal from "bootstrap/js/dist/modal";

const emit = defineEmits<{
  hide: [];
  chooseLogin: [];
  chooseArchiveOnly: [];
}>();

const hide = () => {
  emit("hide");
};

const xAccountModeModal = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

const loginClicked = () => {
  emit("chooseLogin");
  if (modalInstance) {
    modalInstance.hide();
  }
};

const archiveOnlyClicked = () => {
  emit("chooseArchiveOnly");
  if (modalInstance) {
    modalInstance.hide();
  }
};

onMounted(async () => {
  const modalElement = xAccountModeModal.value;
  if (modalElement) {
    modalInstance = new Modal(modalElement, {
      backdrop: "static",
      keyboard: false,
    });
    modalInstance.show();

    // The 'hidden.bs.modal' event is triggered when the modal is hidden
    modalElement.addEventListener("hidden.bs.modal", () => {
      hide();
    });
  }
});

onUnmounted(() => {
  if (xAccountModeModal.value && modalInstance) {
    xAccountModeModal.value.removeEventListener("hidden.bs.modal", hide);
  }
});
</script>

<template>
  <div
    id="xAccountModeModal"
    ref="xAccountModeModal"
    class="modal fade"
    role="dialog"
    aria-labelledby="xAccountModeModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h4 class="modal-title">
            {{ $t("modals.xAccountMode.title") }}
          </h4>
        </div>
        <div class="modal-body">
          <p>{{ $t("modals.xAccountMode.description") }}</p>

          <div class="d-grid gap-3 mt-4">
            <button class="btn btn-primary btn-lg" @click="loginClicked">
              {{ $t("modals.xAccountMode.loginButton") }}
            </button>
            <button
              class="btn btn-secondary btn-lg"
              @click="archiveOnlyClicked"
            >
              {{ $t("modals.xAccountMode.archiveOnlyButton") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-body p {
  margin-bottom: 0.75rem;
}

.btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}
</style>
