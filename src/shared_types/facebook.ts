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
    storiesSaved: number;
}

export function emptyFacebookProgress(): FacebookProgress {
    return {
        currentJob: "",
        isSavePostsFinished: false,
        storiesSaved: 0,
    };
}

export type FacebookPostItem = {
    id: string; // storyID
    u: string; // URL
    t: string; //text
    d: string; // createdAt
    m: string[]; // media filenames
}

export type FacebookDeletePostsStartResponse = {
    posts: FacebookPostItem[];
}

export type FacebookDatabaseStats = {
    storiesSaved: number;
    storiesDeleted: number;
}

export function emptyFacebookDatabaseStats(): FacebookDatabaseStats {
    return {
        storiesSaved: 0,
        storiesDeleted: 0,
    }
}
