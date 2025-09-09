export type BlueskyMigrationProfile = {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
};

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
