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

  /** Are there advanced configuration options available? */
  hasAdvancedOptions: boolean;

  /** Does platform support multiple data export formats? */
  hasMultipleExportFormats: boolean;

  /** Does platform require special handling for rate limiting? */
  hasRateLimitHandling: boolean;
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

  /** Advanced options documentation (optional, only if hasAdvancedOptions is true) */
  advancedDocs?: string;
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
 * Platform-specific premium feature configuration
 */
export interface PlatformPremiumConfig {
  /** List of premium feature names for this platform */
  features: string[];

  /** Whether premium is required for basic operations */
  requiredForBasicOps: boolean;

  /** Whether premium is required for data deletion */
  requiredForDeletion: boolean;

  /** Whether premium is required for migration features */
  requiredForMigration: boolean;
}

/**
 * State machine configuration for platform-specific wizard flows
 */
export interface PlatformStateConfig {
  /** Map of state enum values to display names */
  stateDisplayNames: Record<string, string>;

  /** Initial state when platform view loads */
  initialState: string;

  /** States that represent display/idle modes (end state loop) */
  displayStates: string[];

  /** States that require authentication */
  authRequiredStates: string[];

  /** States that require premium access */
  premiumRequiredStates: string[];
}

/**
 * Complete platform configuration interface
 * This defines everything needed to configure a platform view
 */
export interface PlatformConfig {
  /** Internal platform identifier (e.g., 'X', 'Facebook') */
  name: string;

  /** Human-readable platform name (e.g., 'X (Twitter)', 'Facebook') */
  displayName: string;

  /** Platform feature flags */
  features: PlatformFeatures;

  /** Platform-specific URLs */
  urls: PlatformUrls;

  /** Component mapping for the platform */
  components: PlatformComponents;

  /** Premium feature configuration */
  premium: PlatformPremiumConfig;

  /** State machine configuration */
  states: PlatformStateConfig;

  /** Platform version (for compatibility checking) */
  version: string;
}

/**
 * Registry type for managing multiple platform configurations
 */
export type PlatformConfigRegistry = Record<string, PlatformConfig>;

/**
 * Utility type for platform names (used for type safety)
 */
export type PlatformName = string;

/**
 * Configuration validation result
 */
export interface PlatformConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
