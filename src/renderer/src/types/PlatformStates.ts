/**
 * Platform States - Single Source of Truth
 *
 * This file defines ALL platform states for the entire application.
 * - Common states: Shared across all platforms
 * - Platform-specific states: Used only by specific platforms
 *
 * Usage:
 * - In platform ViewModels: Reference these values in State enums
 * - In generic components: Import and use these constants for state comparisons
 * - When adding a new state: Add it here first, then reference it in the ViewModel
 */

export const PlatformStates = {
  // ============================================================================
  // COMMON PLATFORM STATES (used by multiple platforms)
  // ============================================================================

  /** User login/authentication screen */
  Login: "Login",

  /** Initial wizard loading state */
  WizardStart: "WizardStart",

  /** Pre-start wizard state (before WizardStart) */
  WizardPrestart: "WizardPrestart",

  /** Active job execution state */
  RunJobs: "RunJobs",

  /** Jobs completed successfully */
  FinishedRunningJobs: "FinishedRunningJobs",

  /** Display finished jobs results */
  FinishedRunningJobsDisplay: "FinishedRunningJobsDisplay",

  /** Review wizard page before starting jobs */
  WizardReview: "WizardReview",

  /** Display review wizard page */
  WizardReviewDisplay: "WizardReviewDisplay",

  /** Premium feature check wizard page */
  WizardCheckPremium: "WizardCheckPremium",

  /** Display premium check wizard page */
  WizardCheckPremiumDisplay: "WizardCheckPremiumDisplay",

  /** Build options configuration wizard page */
  WizardBuildOptions: "WizardBuildOptions",

  /** Display build options wizard page */
  WizardBuildOptionsDisplay: "WizardBuildOptionsDisplay",

  /** Archive options configuration wizard page */
  WizardArchiveOptions: "WizardArchiveOptions",

  /** Display archive options wizard page */
  WizardArchiveOptionsDisplay: "WizardArchiveOptionsDisplay",

  /** Delete options configuration wizard page */
  WizardDeleteOptions: "WizardDeleteOptions",

  /** Display delete options wizard page */
  WizardDeleteOptionsDisplay: "WizardDeleteOptionsDisplay",

  /** Delete review wizard page */
  WizardDeleteReview: "WizardDeleteReview",

  /** Display delete review wizard page */
  WizardDeleteReviewDisplay: "WizardDeleteReviewDisplay",

  /** Debug mode state for development */
  Debug: "Debug",

  // ============================================================================
  // X-SPECIFIC STATES
  // ============================================================================

  /** X: Dashboard wizard page */
  WizardDashboard: "WizardDashboard",

  /** X: Display dashboard wizard page */
  WizardDashboardDisplay: "WizardDashboardDisplay",

  /** X: Database wizard page */
  WizardDatabase: "WizardDatabase",

  /** X: Display database wizard page */
  WizardDatabaseDisplay: "WizardDatabaseDisplay",

  /** X: Import or build selection wizard page */
  WizardImportOrBuild: "WizardImportOrBuild",

  /** X: Display import or build wizard page */
  WizardImportOrBuildDisplay: "WizardImportOrBuildDisplay",

  /** X: Import start wizard page */
  WizardImportStart: "WizardImportStart",

  /** X: Display import start wizard page */
  WizardImportStartDisplay: "WizardImportStartDisplay",

  /** X: Importing wizard page */
  WizardImporting: "WizardImporting",

  /** X: Display importing wizard page */
  WizardImportingDisplay: "WizardImportingDisplay",

  /** X: Migrate to Bluesky wizard page */
  WizardMigrateToBluesky: "WizardMigrateToBluesky",

  /** X: Display migrate to Bluesky wizard page */
  WizardMigrateToBlueskyDisplay: "WizardMigrateToBlueskyDisplay",

  /** X: Tombstone (account suspended) wizard page */
  WizardTombstone: "WizardTombstone",

  /** X: Display tombstone wizard page */
  WizardTombstoneDisplay: "WizardTombstoneDisplay",

  /** X: Archive only mode wizard page */
  WizardArchiveOnly: "WizardArchiveOnly",

  /** X: Display archive only wizard page */
  WizardArchiveOnlyDisplay: "WizardArchiveOnlyDisplay",

  // ==========================================================================
  // FACEBOOK-SPECIFIC STATES
  // ==========================================================================
  /** Facebook: Dashboard wizard page */
  FacebookWizardDashboard: "FacebookWizardDashboard",

  /** Facebook: Display dashboard wizard page */
  FacebookWizardDashboardDisplay: "FacebookWizardDashboardDisplay",

  /** Facebook: Get archive from Meta wizard page */
  FacebookWizardGetArchive: "FacebookWizardGetArchive",

  /** Facebook: Display get archive wizard page */
  FacebookWizardGetArchiveDisplay: "FacebookWizardGetArchiveDisplay",
} as const;
