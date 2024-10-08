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
    deletedAt: string | null;
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
    semipheralVersion: string;
    username: string;
    createdAt: string;
    tweets: Tweet[];
    likes: Tweet[];
    users: Record<string, User>;
    conversations: Conversation[];
    messages: Message[];
};