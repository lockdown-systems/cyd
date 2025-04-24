export interface Post {
    postID: string;
    createdAt: string;
    text: string;
    title: string;
    isReposted: boolean;
    archivedAt: string | null;
    media?: {
        mediaId: string;
        type: string;
        uri: string;
        description: string | null;
        createdAt: string | null;
    }[];
    urls?: string[];
}

export type User = {
    userID: string;
    name: string;
    username: string;
    profileImageDataURI: string;
};

export type FacebookArchive = {
    appVersion: string;
    username: string;
    createdAt: string;
    posts: Post[];
};
