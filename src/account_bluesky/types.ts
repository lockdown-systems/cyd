// Row shapes in a Bluesky local account's private runtime database.

export interface BlueskyJobRow {
  id: number;
  jobType: string;
  status: string;
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progressJSON: string | null;
  error: string | null;
}

export interface BlueskyMediaRow {
  digest: string;
  byteLength: number;
  mediaType: string;
  createdAt: string;
}
