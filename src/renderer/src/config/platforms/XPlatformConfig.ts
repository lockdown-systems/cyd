import type { PlatformConfig } from "../../types/PlatformConfig";
import { State } from "../../view_models/XViewModel";

// Import X platform components
import XJobStatusComponent from "../../views/x/components/XJobStatusComponent.vue";
import XWizardSidebar from "../../views/x/wizard/XWizardSidebar.vue";
import XWizardDashboard from "../../views/x/wizard/XWizardDashboard.vue";
import XWizardDatabasePage from "../../views/x/wizard/XWizardDatabasePage.vue";
import XWizardImportPage from "../../views/x/wizard/XWizardImportPage.vue";
import XWizardImportingPage from "../../views/x/wizard/XWizardImportingPage.vue";
import XWizardBuildOptionsPage from "../../views/x/wizard/XWizardBuildOptionsPage.vue";
import XWizardArchiveOptionsPage from "../../views/x/wizard/XWizardArchiveOptionsPage.vue";
import XWizardDeleteOptionsPage from "../../views/x/wizard/XWizardDeleteOptionsPage.vue";
import XWizardReviewPage from "../../views/x/wizard/XWizardReviewPage.vue";
import XWizardCheckPremium from "../../views/x/wizard/XWizardCheckPremium.vue";
import XWizardMigrateBluesky from "../../views/x/wizard/XWizardMigrateBluesky.vue";
import XWizardTombstone from "../../views/x/wizard/XWizardTombstone.vue";
import XWizardFinished from "../../views/x/wizard/XWizardFinished.vue";
import XWizardArchiveOnly from "../../views/x/wizard/XWizardArchiveOnly.vue";
import XDisplayTweet from "../../views/x/components/XDisplayTweet.vue";
import XLastImportOrBuildComponent from "../../views/x/components/XLastImportOrBuildComponent.vue";

/**
 * X Platform Configuration
 * Defines all capabilities, components, and settings for the X (Twitter) platform
 */
export const XPlatformConfig: PlatformConfig = {
  name: "X",

  features: {
    hasArchiveOnly: true, // X supports "Archive Only" mode to skip authentication
    hasPremiumGating: true, // X has complex premium gating for certain features
    hasComplexImport: true, // X supports multi-step import workflows (zip files, etc.)
    hasMigration: true, // X supports migration to Bluesky
    hasU2FSupport: true, // X supports U2F security keys for 2FA
  },

  urls: {
    u2fDocs: "https://docs.cyd.social/docs/x/tips/u2f",
    helpDocs: "https://docs.cyd.social/docs/x",
    migrationDocs: "https://docs.cyd.social/docs/x/migrate-bluesky",
  },

  components: {
    jobStatus: XJobStatusComponent,
    wizardSidebar: XWizardSidebar,
    displayContent: XDisplayTweet,
    lastImportOrBuild: XLastImportOrBuildComponent,
    finishedRunningJobs: XWizardFinished,

    // Map wizard states to their corresponding components
    wizardPages: {
      [State.WizardDashboardDisplay]: XWizardDashboard,
      [State.WizardDatabaseDisplay]: XWizardDatabasePage,
      [State.WizardImportStartDisplay]: XWizardImportPage,
      [State.WizardImportingDisplay]: XWizardImportingPage,
      [State.WizardBuildOptionsDisplay]: XWizardBuildOptionsPage,
      [State.WizardArchiveOptionsDisplay]: XWizardArchiveOptionsPage,
      [State.WizardDeleteOptionsDisplay]: XWizardDeleteOptionsPage,
      [State.WizardReviewDisplay]: XWizardReviewPage,
      [State.WizardCheckPremiumDisplay]: XWizardCheckPremium,
      [State.WizardMigrateToBlueskyDisplay]: XWizardMigrateBluesky,
      [State.WizardTombstoneDisplay]: XWizardTombstone,
      [State.FinishedRunningJobsDisplay]: XWizardFinished,
      [State.WizardArchiveOnlyDisplay]: XWizardArchiveOnly,
    },
  },
};
