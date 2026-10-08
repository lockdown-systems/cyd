import type { PlatformConfig } from "../../types/PlatformConfig";
import { PlatformStates } from "../../types/PlatformStates";
import BlueskyJobStatusComponent from "../../views/bluesky/components/BlueskyJobStatusComponent.vue";
import BlueskyProgressComponent from "../../views/bluesky/components/BlueskyProgressComponent.vue";
import BlueskyWizardSidebar from "../../views/bluesky/wizard/BlueskyWizardSidebar.vue";
import BlueskyWizardDashboard from "../../views/bluesky/wizard/BlueskyWizardDashboard.vue";
import BlueskyWizardConnect from "../../views/bluesky/wizard/BlueskyWizardConnect.vue";
import BlueskyWizardSave from "../../views/bluesky/wizard/BlueskyWizardSave.vue";
import BlueskyWizardBrowse from "../../views/bluesky/wizard/BlueskyWizardBrowse.vue";
import BlueskyWizardFinished from "../../views/bluesky/wizard/BlueskyWizardFinished.vue";

export const BlueskyPlatformConfig: PlatformConfig = {
  name: "Bluesky",

  features: {
    hasArchiveOnly: false,
    hasPremiumGating: false,
    hasComplexImport: false,
    hasMigration: false,
    hasU2FSupport: false,
    // Bluesky talks to the AT Protocol directly, so there is no browser to
    // automate and no login page to render.
    usesWebview: false,
  },

  urls: {
    helpDocs: "https://docs.cyd.social/docs/bluesky",
  },

  components: {
    jobStatus: BlueskyJobStatusComponent,
    // Shown beside the job status while a save is running.
    displayContent: BlueskyProgressComponent,
    finishedRunningJobs: BlueskyWizardFinished,
    wizardSidebar: BlueskyWizardSidebar,
    wizardPages: {
      [PlatformStates.BlueskyWizardDashboardDisplay]: BlueskyWizardDashboard,
      [PlatformStates.BlueskyWizardConnectDisplay]: BlueskyWizardConnect,
      [PlatformStates.BlueskyWizardSaveDisplay]: BlueskyWizardSave,
      [PlatformStates.BlueskyWizardBrowseDisplay]: BlueskyWizardBrowse,
      [PlatformStates.FinishedRunningJobsDisplay]: BlueskyWizardFinished,
    },
  },
};
