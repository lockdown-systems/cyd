import type { BlueskyIdentityProfile } from "./bluesky";

/**
 * The X migration's view of a Bluesky identity. It is the same profile the
 * Bluesky platform reads, because both go through the same shared OAuth
 * session and the same AT Protocol call.
 */
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
