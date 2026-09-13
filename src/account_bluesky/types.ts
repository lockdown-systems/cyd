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

export interface BlueskyProfileRow {
  id: string;
  did: string;
  handle: string | null;
  displayName: string | null;
  description: string | null;
  avatarAssetID: string | null;
  bannerAssetID: string | null;
  capturedAt: string;
}

export interface BlueskyRecordRow {
  uri: string;
  cid: string | null;
  recordType: string;
  authorProfileID: string;
  indexedAt: string | null;
  createdAt: string;
  firstObservedAt: string;
  observedAt: string;
  sourceDeletedAt: string | null;
  text: string | null;
  facetsJSON: string | null;
  payloadJSON: string;
}

export interface BlueskySelectionRow {
  category: string;
  subjectID: string;
  selectedAt: string;
}

export interface BlueskyRecordContextRow {
  recordURI: string;
  kind: string;
  contextRecordURI: string | null;
  contextProfileID: string | null;
  externalJSON: string | null;
}

export interface BlueskyAssetRow {
  id: string;
  kind: string;
  mediaType: string;
  byteCount: number | null;
  digest: string | null;
  availability: string;
  unavailableReason: string | null;
  sourceURL: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  attempts: number;
  lastAttemptAt: string | null;
}

export interface BlueskyAssetOwnerRow {
  ownerType: string;
  ownerID: string;
  assetID: string;
  role: string;
  position: number;
}

export interface BlueskyCheckpointRow {
  category: string;
  stage: string;
  cursor: string | null;
  pagesListed: number;
  recordsSaved: number;
  mediaSaved: number;
  mediaFailed: number;
  updatedAt: string;
}
