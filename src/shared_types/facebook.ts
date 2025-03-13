// Facebook models

export type FacebookJob = {
    id: number | null;
    jobType: string; // "login", "...",
    status: string; // "pending", "running", "finished", "failed", "canceled"
    scheduledAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    progressJSON: string;
    error: string | null;
};

// Other Facebook types

export type FacebookProgress = {
    currentJob: string;
}

export function emptyFacebookProgress(): FacebookProgress {
    return {
        currentJob: ""
    };
}

export type FacebookImportArchiveResponse = {
    status: string; // "success", "error"
    errorMessage: string;
    importCount: number;
    skipCount: number;
}
