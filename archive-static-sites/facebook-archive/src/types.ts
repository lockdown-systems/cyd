export type Post = {
    postID: string;
    createdAt: string;
    text: string;
    path: string;
    archivedAt: string | null;
};

export type FacebookArchive = {
    posts: Post[];
    username: string;
    appVersion: string;
    createdAt: string;
};

export type User = {
    userID: string;
    name: string;
    username: string;
    profileImageDataURI: string;
};