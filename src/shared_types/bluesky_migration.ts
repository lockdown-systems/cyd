import type { BlueskyIdentityProfile } from "./bluesky";

// Same profile the Bluesky platform reads: both go through the same shared
// OAuth session and AT Protocol call.
export type BlueskyMigrationProfile = BlueskyIdentityProfile;

export interface BlueskyAPIError {
  error: string;
  headers: {
    [key: string]: string;
  };
  success: boolean;
  status: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isBlueskyAPIError = (obj: any): obj is BlueskyAPIError => {
  return (
    obj.error !== undefined &&
    obj.headers !== undefined &&
    obj.success !== undefined &&
    obj.status !== undefined
  );
};
