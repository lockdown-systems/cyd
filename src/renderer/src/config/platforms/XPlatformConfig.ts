import type { PlatformConfig } from "../../types/PlatformConfig";
import { State } from "../../view_models/XViewModel";

// Import X platform components
import XProgressComponent from "../../views/x/XProgressComponent.vue";
import XJobStatusComponent from "../../views/x/XJobStatusComponent.vue";
import XWizardSidebar from "../../views/x/XWizardSidebar.vue";
import XWizardDashboard from "../../views/x/XWizardDashboard.vue";
import XWizardDatabasePage from "../../views/x/XWizardDatabasePage.vue";
import XWizardImportPage from "../../views/x/XWizardImportPage.vue";
import XWizardImportingPage from "../../views/x/XWizardImportingPage.vue";
import XWizardBuildOptionsPage from "../../views/x/XWizardBuildOptionsPage.vue";
import XWizardArchiveOptionsPage from "../../views/x/XWizardArchiveOptionsPage.vue";
import XWizardDeleteOptionsPage from "../../views/x/XWizardDeleteOptionsPage.vue";
import XWizardReviewPage from "../../views/x/XWizardReviewPage.vue";
import XWizardCheckPremium from "../../views/x/XWizardCheckPremium.vue";
import XWizardMigrateBluesky from "../../views/x/XWizardMigrateBluesky.vue";
import XWizardTombstone from "../../views/x/XWizardTombstone.vue";
import XWizardFinished from "../../views/x/XWizardFinished.vue";
import XWizardArchiveOnly from "../../views/x/XWizardArchiveOnly.vue";
import XDisplayTweet from "../../views/x/XDisplayTweet.vue";
import XLastImportOrBuildComponent from "../../views/x/XLastImportOrBuildComponent.vue";

/**
 * X Platform Configuration
 * Defines all capabilities, components, and settings for the X (Twitter) platform
 */
export const XPlatformConfig: PlatformConfig = {
  name: "X",
  displayName: "X (Twitter)",
  version: "1.0.0",

  features: {
    hasArchiveOnly: true, // X supports "Archive Only" mode to skip authentication
    hasPremiumGating: true, // X has complex premium gating for certain features
    hasComplexImport: true, // X supports multi-step import workflows (zip files, etc.)
    hasMigration: true, // X supports migration to Bluesky
    hasU2FSupport: true, // X supports U2F security keys for 2FA
    hasAdvancedOptions: true, // X has advanced configuration options
    hasMultipleExportFormats: true, // X supports multiple export formats
    hasRateLimitHandling: true, // X requires special rate limiting handling
  },

  urls: {
    u2fDocs: "https://docs.cyd.social/docs/x/tips/u2f",
    helpDocs: "https://docs.cyd.social/docs/x",
    migrationDocs: "https://docs.cyd.social/docs/x/migrate-bluesky",
    advancedDocs: "https://docs.cyd.social/docs/x/tips",
  },

  components: {
    jobStatus: XJobStatusComponent,
    wizardSidebar: XWizardSidebar,
    progressComponent: XProgressComponent,
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

  premium: {
    features: [
      "Delete tweets",
      "Delete retweets",
      "Delete likes",
      "Delete bookmarks",
      "Migrate tweets to Bluesky",
      "Advanced export options",
    ],
    requiredForBasicOps: false, // Basic archiving doesn't require premium
    requiredForDeletion: true, // Deletion features require premium
    requiredForMigration: true, // Migration to Bluesky requires premium
  },

  states: {
    stateDisplayNames: {
      [State.WizardStart]: "Starting...",
      [State.WizardPrestart]: "Preparing",
      [State.WizardDashboardDisplay]: "Dashboard",
      [State.WizardDatabaseDisplay]: "Database",
      [State.WizardImportStartDisplay]: "Import",
      [State.WizardImportingDisplay]: "Importing...",
      [State.WizardBuildOptionsDisplay]: "Build Options",
      [State.WizardArchiveOptionsDisplay]: "Archive Options",
      [State.WizardDeleteOptionsDisplay]: "Delete Options",
      [State.WizardReviewDisplay]: "Review",
      [State.WizardCheckPremiumDisplay]: "Premium Check",
      [State.WizardMigrateToBlueskyDisplay]: "Migrate to Bluesky",
      [State.WizardTombstoneDisplay]: "Account Suspended",
      [State.WizardArchiveOnlyDisplay]: "Archive Only",
      [State.Login]: "Login",
      [State.RunJobs]: "Running Jobs",
      [State.FinishedRunningJobsDisplay]: "Finished",
      [State.Debug]: "Debug Mode",
    },

    initialState: State.WizardStart,

    displayStates: [
      State.WizardDashboardDisplay,
      State.WizardDatabaseDisplay,
      State.WizardImportStartDisplay,
      State.WizardBuildOptionsDisplay,
      State.WizardArchiveOptionsDisplay,
      State.WizardDeleteOptionsDisplay,
      State.WizardReviewDisplay,
      State.WizardCheckPremiumDisplay,
      State.WizardMigrateToBlueskyDisplay,
      State.WizardTombstoneDisplay,
      State.WizardArchiveOnlyDisplay,
      State.FinishedRunningJobsDisplay,
      State.Debug,
    ],

    authRequiredStates: [
      State.WizardDeleteOptionsDisplay,
      State.WizardCheckPremiumDisplay,
      State.WizardMigrateToBlueskyDisplay,
    ],

    premiumRequiredStates: [
      State.WizardDeleteOptionsDisplay,
      State.WizardMigrateToBlueskyDisplay,
    ],
  },
};
