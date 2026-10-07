import type { PlatformConfig } from "../../types/PlatformConfig";
import { PlatformStates } from "../../types/PlatformStates";
import BlueskyJobStatusComponent from "../../views/bluesky/components/BlueskyJobStatusComponent.vue";
import BlueskyWizardSidebar from "../../views/bluesky/wizard/BlueskyWizardSidebar.vue";
import BlueskyWizardDashboard from "../../views/bluesky/wizard/BlueskyWizardDashboard.vue";
import BlueskyWizardConnect from "../../views/bluesky/wizard/BlueskyWizardConnect.vue";

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
    wizardSidebar: BlueskyWizardSidebar,
    wizardPages: {
      [PlatformStates.BlueskyWizardDashboardDisplay]: BlueskyWizardDashboard,
      [PlatformStates.BlueskyWizardConnectDisplay]: BlueskyWizardConnect,
    },
  },
};
