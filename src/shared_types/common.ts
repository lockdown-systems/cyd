/**
 * Common job structure shared across all platform account controllers.
 * Both XJob and FacebookJob conform to this structure.
 */
export type PlatformJob = {
  id: number | null;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  progressJSON: string;
  error: string | null;
};

export type ResponseData = {
  host: string;
  url: string;
  status: number;
  requestBody: string;
  responseHeaders: Record<string, string | string[] | undefined>;
  responseBody: string;
  processed: boolean;
};

export type ArchiveInfo = {
  folderEmpty: boolean;
  indexHTMLExists: boolean;
};

export function emptyArchiveInfo(): ArchiveInfo {
  return {
    folderEmpty: true,
    indexHTMLExists: false,
  };
}

// Models

export type ErrorReport = {
  id: number;
  createdAt: string;
  accountID: number;
  appVersion: string;
  clientPlatform: string;
  accountType: string;
  errorReportType: string;
  errorReportData: string;
  accountUsername: string;
  screenshotDataURI: string;
  sensitiveContextData: string;
  status: string; // "new", "submitted", and "dismissed"
};
