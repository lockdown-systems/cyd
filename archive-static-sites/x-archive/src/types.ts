export type Tweet = {
    tweetID: string;
    username: string;
    createdAt: string;
    likeCount: number;
    quoteCount: number;
    replyCount: number;
    retweetCount: number;
    isLiked: boolean;
    isRetweeted: boolean;
    text: string;
    path: string;
    archivedAt: string | null;
    deletedTweetAt: string | null;
    deletedRetweetAt: string | null;
    deletedLikeAt: string | null;
    deletedBookmarkAt: string | null;
    media: {
        mediaType: string;
        url: string;
        filename: string;
    }[];
    urls: {
        url: string;
        displayURL: string;
        expandedURL: string;
    }[];

};

export type User = {
    userID: string;
    name: string;
    username: string;
    profileImageDataURI: string;
};

export type Conversation = {
    conversationID: string;
    type: string;
    sortTimestamp: string | null;
    participants: string[];
    participantSearchString: string;
    deletedAt: string | null;
};

export type Message = {
    messageID: string;
    conversationID: string;
    createdAt: string;
    senderID: string;
    text: string;
    deletedAt: string | null;
};

export type XArchive = {
    appVersion: string;
    username: string;
    createdAt: string;
    tweets: Tweet[];
    retweets: Tweet[];
    likes: Tweet[];
    bookmarks: Tweet[];
    users: Record<string, User>;
    conversations: Conversation[];
    messages: Message[];
};