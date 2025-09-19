import type {
  PlatformConfig,
  PlatformConfigRegistry,
} from "../../types/PlatformConfig";
import { XPlatformConfig } from "./XPlatformConfig";
import { FacebookPlatformConfig } from "./FacebookPlatformConfig";

/**
 * Central registry of all platform configurations
 */
export const platformRegistry: PlatformConfigRegistry = {
  X: XPlatformConfig,
  Facebook: FacebookPlatformConfig,
};

/**
 * Get platform configuration by name
 * @param platformName - The name of the platform (e.g., 'X', 'Facebook')
 * @returns Platform configuration object or undefined if not found
 */
export function getPlatformConfig(
  platformName: string,
): PlatformConfig | undefined {
  return platformRegistry[platformName];
}

/**
 * Get all available platform names
 * @returns Array of platform names
 */
export function getAvailablePlatforms(): string[] {
  return Object.keys(platformRegistry);
}

/**
 * Check if a platform is supported
 * @param platformName - The name of the platform to check
 * @returns True if platform is supported, false otherwise
 */
export function isPlatformSupported(platformName: string): boolean {
  return platformName in platformRegistry;
}

/**
 * Get platform configuration with validation
 * @param platformName - The name of the platform
 * @returns Platform configuration object
 * @throws Error if platform is not supported
 */
export function getValidatedPlatformConfig(
  platformName: string,
): PlatformConfig {
  const config = getPlatformConfig(platformName);
  if (!config) {
    throw new Error(
      `Platform "${platformName}" is not supported. Available platforms: ${getAvailablePlatforms().join(", ")}`,
    );
  }
  return config;
}

/**
 * Get all platform configurations
 * @returns Object containing all platform configurations
 */
export function getAllPlatformConfigs(): PlatformConfigRegistry {
  return { ...platformRegistry };
}
