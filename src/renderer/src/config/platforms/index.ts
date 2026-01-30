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
 * @param platformName - The name of the platform (e.g., 'X')
 * @returns Platform configuration object or undefined if not found
 */
export function getPlatformConfig(
  platformName: string,
): PlatformConfig | undefined {
  return platformRegistry[platformName];
}
