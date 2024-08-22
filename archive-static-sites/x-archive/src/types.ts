export type Tweet = {
    tweetID: string;
    username: string;
    createdAt: Date;
    likeCount: number;
    quoteCount: number;
    replyCount: number;
    retweetCount: number;
    isLiked: boolean;
    isRetweeted: boolean;
    text: string;
    path: string;
    archivedAt: Date | null;
    deletedAt: Date | null;
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
    sortTimestamp: Date;
    participants: string[];
    deletedAt: Date | null;
};

export type Message = {
    messageID: string;
    conversationID: string;
    createdAt: Date;
    senderID: string;
    text: string;
    deletedAt: Date | null;
};

export type XArchive = {
    username: string;
    tweets: Tweet[];
    users: User[];
    conversations: Conversation[];
    messages: Message[];
};