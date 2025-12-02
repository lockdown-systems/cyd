import type { PlatformConfig } from "../../types/PlatformConfig";
import { PlatformStates } from "../../types/PlatformStates";
import FacebookJobStatusComponent from "../../views/facebook/components/FacebookJobStatusComponent.vue";
import FacebookWizardSidebar from "../../views/facebook/wizard/FacebookWizardSidebar.vue";
import FacebookWizardDashboard from "../../views/facebook/wizard/FacebookWizardDashboard.vue";
import FacebookLoginPage from "../../views/facebook/wizard/FacebookLoginPage.vue";

export const FacebookPlatformConfig: PlatformConfig = {
  name: "Facebook",
  features: {
    hasArchiveOnly: false,
    hasPremiumGating: false,
    hasComplexImport: false,
    hasMigration: false,
    hasU2FSupport: true,
  },
  urls: {
    helpDocs: "https://docs.cyd.social/docs/facebook",
  },
  components: {
    jobStatus: FacebookJobStatusComponent,
    wizardSidebar: FacebookWizardSidebar,
    wizardPages: {
      [PlatformStates.Login]: FacebookLoginPage,
      [PlatformStates.FacebookWizardDashboardDisplay]: FacebookWizardDashboard,
    },
  },
};
