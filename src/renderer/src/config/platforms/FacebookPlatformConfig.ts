import type { PlatformConfig } from "../../types/PlatformConfig";
import { State } from "../../view_models/FacebookViewModel";

// Import Facebook platform components
import FacebookJobStatusComponent from "../../views/facebook/FacebookJobStatusComponent.vue";
import FacebookWizardSidebar from "../../views/facebook/FacebookWizardSidebar.vue";
import FacebookWizardBuildOptionsPage from "../../views/facebook/FacebookWizardBuildOptionsPage.vue";
import FacebookWizardDeleteOptionsPage from "../../views/facebook/FacebookWizardDeleteOptionsPage.vue";
import FacebookWizardReviewPage from "../../views/facebook/FacebookWizardReviewPage.vue";
import FacebookFinishedRunningJobsPage from "../../views/facebook/FacebookFinishedRunningJobsPage.vue";
import FacebookLastImportOrBuildComponent from "../../views/facebook/FacebookLastImportOrBuildComponent.vue";

/**
 * Facebook Platform Configuration
 * Defines all capabilities, components, and settings for the Facebook platform
 */
export const FacebookPlatformConfig: PlatformConfig = {
  name: "Facebook",

  features: {
    hasArchiveOnly: false, // Facebook does not support "Archive Only" mode
    hasPremiumGating: true, // Facebook has premium gating (commented out in code but structure exists)
    hasComplexImport: false, // Facebook has simpler import workflows
    hasMigration: false, // Facebook does not support migration to other platforms
    hasU2FSupport: false, // Facebook does not support U2F security keys in our implementation
  },

  urls: {
    helpDocs: "https://docs.cyd.social/docs/facebook",
  },

  components: {
    jobStatus: FacebookJobStatusComponent,
    wizardSidebar: FacebookWizardSidebar,
    lastImportOrBuild: FacebookLastImportOrBuildComponent,
    finishedRunningJobs: FacebookFinishedRunningJobsPage,

    // Map wizard states to their corresponding components
    wizardPages: {
      [State.WizardBuildOptionsDisplay]: FacebookWizardBuildOptionsPage,
      [State.WizardArchiveOptionsDisplay]: FacebookWizardBuildOptionsPage, // Reuse build options for now
      [State.WizardDeleteOptionsDisplay]: FacebookWizardDeleteOptionsPage,
      [State.WizardCheckPremiumDisplay]: FacebookWizardReviewPage, // Premium check uses review page for now
      [State.WizardReviewDisplay]: FacebookWizardReviewPage,
      [State.WizardDeleteReviewDisplay]: FacebookWizardReviewPage, // Reuse review page for delete review
      [State.FinishedRunningJobsDisplay]: FacebookFinishedRunningJobsPage,
    },
  },
};
