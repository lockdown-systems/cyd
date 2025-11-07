import { describe, it, expect } from "vitest";
import {
  State,
  RunJobsState,
  FailureState,
  X_AUTHORIZATION_HEADER,
  tombstoneUpdateBioCreditCydText,
} from "./types";

describe("types.ts", () => {
  describe("X_AUTHORIZATION_HEADER", () => {
    it("should have the correct Bearer token value", () => {
      expect(X_AUTHORIZATION_HEADER).toBe(
        "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
      );
    });

    it("should start with 'Bearer '", () => {
      expect(X_AUTHORIZATION_HEADER).toMatch(/^Bearer /);
    });
  });

  describe("State enum", () => {
    it("should have Login state", () => {
      expect(State.Login).toBe("Login");
    });

    it("should have WizardPrestart state", () => {
      expect(State.WizardPrestart).toBe("WizardPrestart");
    });

    it("should have WizardStart state", () => {
      expect(State.WizardStart).toBe("WizardStart");
    });

    it("should have WizardDashboard states", () => {
      expect(State.WizardDashboard).toBe("WizardDashboard");
      expect(State.WizardDashboardDisplay).toBe("WizardDashboardDisplay");
    });

    it("should have WizardDatabase states", () => {
      expect(State.WizardDatabase).toBe("WizardDatabase");
      expect(State.WizardDatabaseDisplay).toBe("WizardDatabaseDisplay");
    });

    it("should have WizardImportOrBuild states", () => {
      expect(State.WizardImportOrBuild).toBe("WizardImportOrBuild");
      expect(State.WizardImportOrBuildDisplay).toBe(
        "WizardImportOrBuildDisplay",
      );
    });

    it("should have WizardImportStart states", () => {
      expect(State.WizardImportStart).toBe("WizardImportStart");
      expect(State.WizardImportStartDisplay).toBe("WizardImportStartDisplay");
    });

    it("should have WizardImporting states", () => {
      expect(State.WizardImporting).toBe("WizardImporting");
      expect(State.WizardImportingDisplay).toBe("WizardImportingDisplay");
    });

    it("should have WizardBuildOptions states", () => {
      expect(State.WizardBuildOptions).toBe("WizardBuildOptions");
      expect(State.WizardBuildOptionsDisplay).toBe("WizardBuildOptionsDisplay");
    });

    it("should have WizardArchiveOptions states", () => {
      expect(State.WizardArchiveOptions).toBe("WizardArchiveOptions");
      expect(State.WizardArchiveOptionsDisplay).toBe(
        "WizardArchiveOptionsDisplay",
      );
    });

    it("should have WizardDeleteOptions states", () => {
      expect(State.WizardDeleteOptions).toBe("WizardDeleteOptions");
      expect(State.WizardDeleteOptionsDisplay).toBe(
        "WizardDeleteOptionsDisplay",
      );
    });

    it("should have WizardReview states", () => {
      expect(State.WizardReview).toBe("WizardReview");
      expect(State.WizardReviewDisplay).toBe("WizardReviewDisplay");
    });

    it("should have WizardDeleteReview states", () => {
      expect(State.WizardDeleteReview).toBe("WizardDeleteReview");
      expect(State.WizardDeleteReviewDisplay).toBe("WizardDeleteReviewDisplay");
    });

    it("should have WizardCheckPremium states", () => {
      expect(State.WizardCheckPremium).toBe("WizardCheckPremium");
      expect(State.WizardCheckPremiumDisplay).toBe("WizardCheckPremiumDisplay");
    });

    it("should have WizardMigrateToBluesky states", () => {
      expect(State.WizardMigrateToBluesky).toBe("WizardMigrateToBluesky");
      expect(State.WizardMigrateToBlueskyDisplay).toBe(
        "WizardMigrateToBlueskyDisplay",
      );
    });

    it("should have WizardTombstone states", () => {
      expect(State.WizardTombstone).toBe("WizardTombstone");
      expect(State.WizardTombstoneDisplay).toBe("WizardTombstoneDisplay");
    });

    it("should have WizardArchiveOnly states", () => {
      expect(State.WizardArchiveOnly).toBe("WizardArchiveOnly");
      expect(State.WizardArchiveOnlyDisplay).toBe("WizardArchiveOnlyDisplay");
    });

    it("should have RunJobs state", () => {
      expect(State.RunJobs).toBe("RunJobs");
    });

    it("should have FinishedRunningJobs states", () => {
      expect(State.FinishedRunningJobs).toBe("FinishedRunningJobs");
      expect(State.FinishedRunningJobsDisplay).toBe(
        "FinishedRunningJobsDisplay",
      );
    });

    it("should have Debug state", () => {
      expect(State.Debug).toBe("Debug");
    });
  });

  describe("RunJobsState enum", () => {
    it("should have Default empty state", () => {
      expect(RunJobsState.Default).toBe("");
    });

    it("should have DeleteTweets state", () => {
      expect(RunJobsState.DeleteTweets).toBe("DeleteTweets");
    });

    it("should have DeleteRetweets state", () => {
      expect(RunJobsState.DeleteRetweets).toBe("DeleteRetweets");
    });

    it("should have DeleteLikes state", () => {
      expect(RunJobsState.DeleteLikes).toBe("DeleteLikes");
    });

    it("should have DeleteBookmarks state", () => {
      expect(RunJobsState.DeleteBookmarks).toBe("DeleteBookmarks");
    });

    it("should have MigrateBluesky state", () => {
      expect(RunJobsState.MigrateBluesky).toBe("MigrateBluesky");
    });

    it("should have MigrateBlueskyDelete state", () => {
      expect(RunJobsState.MigrateBlueskyDelete).toBe("MigrateBlueskyDelete");
    });
  });

  describe("FailureState enum", () => {
    it("should have indexTweets_FailedToRetryAfterRateLimit state", () => {
      expect(FailureState.indexTweets_FailedToRetryAfterRateLimit).toBe(
        "indexTweets_FailedToRetryAfterRateLimit",
      );
    });

    it("should have indexLikes_FailedToRetryAfterRateLimit state", () => {
      expect(FailureState.indexLikes_FailedToRetryAfterRateLimit).toBe(
        "indexLikes_FailedToRetryAfterRateLimit",
      );
    });

    it("should have indexBookmarks_FailedToRetryAfterRateLimit state", () => {
      expect(FailureState.indexBookmarks_FailedToRetryAfterRateLimit).toBe(
        "indexBookmarks_FailedToRetryAfterRateLimit",
      );
    });
  });

  describe("tombstoneUpdateBioCreditCydText", () => {
    it("should have the correct text", () => {
      expect(tombstoneUpdateBioCreditCydText).toBe(
        " (I escaped X using https://cyd.social)",
      );
    });

    it("should start with a space", () => {
      expect(tombstoneUpdateBioCreditCydText).toMatch(/^ /);
    });

    it("should contain the cyd.social URL", () => {
      expect(tombstoneUpdateBioCreditCydText).toContain("https://cyd.social");
    });
  });
});
