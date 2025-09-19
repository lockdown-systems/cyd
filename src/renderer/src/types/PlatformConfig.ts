import type { Component } from "vue";

/**
 * Platform feature flags that define what capabilities each platform supports
 */
export interface PlatformFeatures {
  /** Can user skip login and just archive data? (X: true, Facebook: false) */
  hasArchiveOnly: boolean;

  /** Does platform require premium subscription for certain features? */
  hasPremiumGating: boolean;

  /** Does platform support complex import workflows with multiple steps? */
  hasComplexImport: boolean;

  /** Can users migrate data to other platforms (e.g., Bluesky)? */
  hasMigration: boolean;

  /** Does platform support U2F security keys for 2FA? */
  hasU2FSupport: boolean;
}

/**
 * Platform-specific URLs for documentation and help
 */
export interface PlatformUrls {
  /** URL to U2F security key documentation (optional, only if hasU2FSupport is true) */
  u2fDocs?: string;

  /** General help documentation URL */
  helpDocs: string;

  /** Migration guides URL (optional, only if hasMigration is true) */
  migrationDocs?: string;
}

/**
 * Platform-specific component mapping for wizard pages and UI elements
 */
export interface PlatformComponents {
  /** Job status display component */
  jobStatus: Component;

  /** Wizard navigation sidebar component */
  wizardSidebar: Component;

  /** Progress display component */
  progressComponent: Component;

  /** Map of wizard page states to their corresponding components */
  wizardPages: Record<string, Component>;

  /** Optional platform-specific display content (e.g., tweet display) */
  displayContent?: Component;

  /** Last import/build status component */
  lastImportOrBuild?: Component;

  /** Finished running jobs page component */
  finishedRunningJobs?: Component;
}

/**
 * Complete platform configuration interface
 * This defines everything needed to configure a platform view
 */
export interface PlatformConfig {
  /** Platform identifier (e.g., 'X', 'Facebook') */
  name: string;

  /** Platform feature flags */
  features: PlatformFeatures;

  /** Platform-specific URLs */
  urls: PlatformUrls;

  /** Component mapping for the platform */
  components: PlatformComponents;
}

/**
 * Registry type for managing multiple platform configurations
 */
export type PlatformConfigRegistry = Record<string, PlatformConfig>;
