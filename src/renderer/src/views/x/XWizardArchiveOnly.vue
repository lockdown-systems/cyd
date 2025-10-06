<script setup lang="ts">
import { getBreadcrumbIcon } from "../../util";
import BaseWizardPage from "../shared_components/wizard/BaseWizardPage.vue";

const emit = defineEmits(["set-state", "update-account"]);

const importArchive = async () => {
  emit("set-state", "WizardImporting");
};

const goBack = () => {
  emit("set-state", "WizardDashboard");
};
</script>

<template>
  <BaseWizardPage
    :breadcrumb-props="{
      buttons: [
        {
          label: 'Dashboard',
          action: () => emit('set-state', 'WizardDashboard'),
          icon: getBreadcrumbIcon('dashboard'),
        },
      ],
      label: 'Import X Archive',
      icon: getBreadcrumbIcon('import'),
    }"
    :button-props="{
      backButtons: [
        {
          label: 'Back to Dashboard',
          action: goBack,
        },
      ],
      nextButtons: [
        {
          label: 'Continue to Import X Archive',
          action: importArchive,
        },
      ],
    }"
  >
    <template #content>
      <div class="wizard-scroll-content">
        <div class="mb-4">
          <h2 class="mb-3">Import X Archive</h2>
          <p class="lead text-muted">
            Can't access your X account? No problem! You can still migrate your
            tweets to Bluesky using an archive file that you previously
            downloaded from X.
          </p>
        </div>

        <div class="row g-4 mb-4">
          <div class="col-md-6">
            <div class="info-card">
              <div class="card-header">
                <h4 class="mb-0">What You'll Need</h4>
              </div>
              <div class="card-body">
                <div class="card-item">
                  <i class="fa-solid fa-file-archive text-primary me-3" />
                  <div>
                    <strong>X Archive File</strong>
                    <p class="mb-0 small text-muted">
                      A copy of your X archive that you downloaded earlier
                    </p>
                  </div>
                </div>
                <div class="card-item">
                  <i class="fa-solid fa-crown text-warning me-3" />
                  <div>
                    <strong>Cyd Premium Plan</strong>
                    <p class="mb-0 small text-muted">
                      Required for migrating to Bluesky
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-6">
            <div class="info-card">
              <div class="card-header">
                <h4 class="mb-0">Unavailable Features</h4>
              </div>
              <div class="card-body">
                <div class="card-item">
                  <i class="fa-solid fa-fire text-muted me-3" />
                  <div>
                    <strong>Can't Delete Data</strong>
                    <p class="mb-0 small text-muted">
                      Cyd can't delete data from your account if you're not
                      logged in
                    </p>
                  </div>
                </div>
                <div class="card-item">
                  <i class="fa-solid fa-floppy-disk text-muted me-3" />
                  <div>
                    <strong>Can't Save Extra Data</strong>
                    <p class="mb-0 small text-muted">
                      Cyd can't save extra data from your account, like HTML
                      versions of your tweets
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </BaseWizardPage>
</template>

<style scoped>
.hero-icon {
  width: 80px;
  height: 80px;
  opacity: 0.9;
}

.info-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e9ecef;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  overflow: hidden;
}

.info-card .card-header {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-bottom: 1px solid #dee2e6;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  font-weight: 600;
}

.card-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
  border-left: 3px solid transparent;
}

.card-item:last-child {
  margin-bottom: 0;
}

.card-item i {
  font-size: 1.25rem;
  margin-top: 0.125rem;
  flex-shrink: 0;
}

.card-item strong {
  display: block;
  margin-bottom: 0.25rem;
  color: #333;
}

.lead {
  font-size: 1.15rem;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .hero-icon {
    width: 64px;
    height: 64px;
  }

  .ready-section {
    padding: 1.5rem;
  }

  .btn-lg {
    padding: 0.65rem 1.5rem;
    font-size: 1rem;
  }
}
</style>
