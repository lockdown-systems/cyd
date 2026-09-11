import { describe, it, expect } from "vitest";
import { getPlatformConfig, platformRegistry } from "./index";
import { BlueskyPlatformConfig } from "./BlueskyPlatformConfig";
import { PlatformStates } from "../../types/PlatformStates";

describe("BlueskyPlatformConfig", () => {
  it("is registered alongside the other platforms", () => {
    expect(Object.keys(platformRegistry)).toContain("Bluesky");
    expect(getPlatformConfig("Bluesky")).toBe(BlueskyPlatformConfig);
  });

  it("declares no browser automation and no premium gating", () => {
    expect(BlueskyPlatformConfig.features).toEqual({
      hasArchiveOnly: false,
      hasPremiumGating: false,
      hasComplexImport: false,
      hasMigration: false,
      hasU2FSupport: false,
      usesWebview: false,
    });
  });

  it("provides the dashboard, a job status component, and a sidebar", () => {
    expect(
      BlueskyPlatformConfig.components.wizardPages[
        PlatformStates.BlueskyWizardDashboardDisplay
      ],
    ).toBeDefined();
    expect(BlueskyPlatformConfig.components.jobStatus).toBeDefined();
    expect(BlueskyPlatformConfig.components.wizardSidebar).toBeDefined();
  });

  it("has no login page, because connecting an account is not built yet", () => {
    expect(
      BlueskyPlatformConfig.components.wizardPages[PlatformStates.Login],
    ).toBeUndefined();
  });
});
