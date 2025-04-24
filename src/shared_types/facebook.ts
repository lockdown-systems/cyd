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
    isSavePostsFinished: boolean;
    postsSaved: number;
}

export function emptyFacebookProgress(): FacebookProgress {
    return {
        currentJob: "",
        isSavePostsFinished: false,
        postsSaved: 0,
    };
}

// TODO: Add additional fields here
export type FacebookDatabaseStats = {
    postsSaved: number;
    postsDeleted: number;
    repostsSaved: number;
    repostsDeleted: number;
}

export function emptyFacebookDatabaseStats(): FacebookDatabaseStats {
    return {
        postsSaved: 0,
        postsDeleted: 0,
        repostsSaved: 0,
        repostsDeleted: 0,
    }
}
