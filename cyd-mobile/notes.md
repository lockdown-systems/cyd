# Bluesky Mobile Platform Notes

## API Reference

atproto API docs are here: https://docs.bsky.app/docs/category/http-reference

### Relevant Endpoints

**Profile & Feed:**

- `app.bsky.actor.getProfile`: Get the display name, avatar, etc. of the user
- `app.bsky.feed.getActorLikes`: Get the user's likes (requires auth, actor must be requesting account)
- `app.bsky.feed.getAuthorFeed`: Get the user's posts and reposts (public, no auth required)
- `app.bsky.graph.getFollows`: Get list of accounts the user follows (public)

**Bookmarks:**

- `app.bsky.bookmark.getBookmarks`: Get the user's bookmarks (requires auth)
- `app.bsky.bookmark.deleteBookmark`: Delete a bookmark

**Chat/DMs:**

- `chat.bsky.convo.listConvos`: List all chat conversations
- `chat.bsky.convo.getMessages`: Get messages in a conversation
- `chat.bsky.convo.getConvo`: Get a chat conversation
- `chat.bsky.convo.leaveConvo`: Leave a chat conversation
- `chat.bsky.convo.deleteMessageForSelf`: Delete a chat message

**Blobs/Media:**

- `com.atproto.sync.getBlob`: Download an uploaded blob

### Save Options

- Save my posts
- Save my likes
- Save my bookmarks
- Save my chat messages
- Save my following list

### Delete Options

- Delete my posts
  - older than X days
  - unless they have at least X reposts
  - or at least X likes
  - exclude posts that are part of a thread that contains at least one post that meets these thresholds
  - exclude posts with media
- Delete my reposts
  - older than X days
- Delete my likes
  - older than X days
- Delete my chat messages
  - older than X days
- Delete all my bookmarks
- Unfollow everyone

---

## BlueskyAccountController Implementation Plan

### Overview

The BlueskyAccountController is responsible for managing a Bluesky account's data archive in the mobile app. It follows the pattern established by `XAccountController` in the desktop app, but adapted for React Native/Expo with `expo-sqlite`.

### Architecture

```
cyd-mobile/
├── controllers/
│   ├── BaseAccountController.ts       # Abstract base class with common functionality
│   └── BlueskyAccountController.ts    # Bluesky-specific implementation
├── database/
│   ├── index.ts                       # Main app database (already exists)
│   ├── migrations.ts                  # Main app migrations (already exists)
│   └── account-db/
│       ├── index.ts                   # Account database factory
│       └── bluesky-migrations.ts      # Bluesky account-specific migrations
└── hooks/
    └── useBlueskyController.ts        # React hook to manage controller lifecycle
```

### BaseAccountController (Mobile)

Abstract class providing:

- Account ID and UUID management
- Database initialization and cleanup
- Progress tracking
- Job queue management
- Config storage (key-value pairs)

```typescript
// cyd-mobile/controllers/BaseAccountController.ts
export abstract class BaseAccountController<TProgress = unknown> {
  protected accountId: number;
  protected accountUUID: string;
  protected db: SQLiteDatabase | null = null;
  protected progress: TProgress;

  abstract getAccountType(): string;
  abstract initDB(): Promise<void>;
  abstract resetProgress(): TProgress;

  async cleanup(): Promise<void>;
  async getConfig(key: string): Promise<string | null>;
  async setConfig(key: string, value: string): Promise<void>;
}
```

### BlueskyAccountController

Extends BaseAccountController with Bluesky-specific functionality:

```typescript
// cyd-mobile/controllers/BlueskyAccountController.ts
export interface BlueskyProgress {
  // Index (save) progress
  postsSaved: number;
  postsTotal: number;
  likesSaved: number;
  likesTotal: number;
  bookmarksSaved: number;
  bookmarksTotal: number;
  followsSaved: number;
  followsTotal: number;
  conversationsSaved: number;
  conversationsTotal: number;
  messagesSaved: number;
  messagesTotal: number;

  // Delete progress
  postsDeleted: number;
  postsToDelete: number;
  repostsDeleted: number;
  repostsToDelete: number;
  likesDeleted: number;
  likesToDelete: number;
  bookmarksDeleted: number;
  bookmarksToDelete: number;
  messagesDeleted: number;
  messagesToDelete: number;
  unfollowed: number;
  toUnfollow: number;

  // Status
  currentAction: string;
  isRunning: boolean;
  error: string | null;
}

export class BlueskyAccountController extends BaseAccountController<BlueskyProgress> {
  private agent: Agent | null = null; // @atproto/api Agent
  private session: OAuthSession | null = null;

  constructor(accountId: number);

  // Initialization
  async initDB(): Promise<void>;
  async initAgent(): Promise<void>; // Initialize authenticated API agent

  // Save operations
  async indexPosts(): Promise<void>;
  async indexLikes(): Promise<void>;
  async indexBookmarks(): Promise<void>;
  async indexFollowing(): Promise<void>;
  async indexConversations(): Promise<void>;
  async indexMessages(convoId: string): Promise<void>;

  // Delete operations
  async deletePosts(options: DeletePostsOptions): Promise<void>;
  async deleteReposts(options: DeleteRepostsOptions): Promise<void>;
  async deleteLikes(options: DeleteLikesOptions): Promise<void>;
  async deleteBookmarks(): Promise<void>;
  async deleteMessages(options: DeleteMessagesOptions): Promise<void>;
  async unfollowAll(): Promise<void>;

  // Media handling
  async downloadMedia(blobCid: string, did: string): Promise<string>; // Returns local file path

  // Stats
  async getDatabaseStats(): Promise<BlueskyDatabaseStats>;
}
```

---

## Database Schema for Bluesky Accounts

Each Bluesky account gets its own SQLite database file stored at:
`${FileSystem.documentDirectory}bluesky-accounts/${did}/data.sqlite3`

### Migration 1: Initial Schema

```sql
-- Configuration key-value store
CREATE TABLE config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

-- Job queue for tracking save/delete operations
CREATE TABLE job (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jobType TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'running', 'completed', 'failed'
  scheduledAt INTEGER NOT NULL,
  startedAt INTEGER,
  finishedAt INTEGER,
  progressJSON TEXT,
  error TEXT
);

-- User profiles (for authors, followed accounts, chat participants)
CREATE TABLE profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT NOT NULL UNIQUE,
  handle TEXT NOT NULL,
  displayName TEXT,
  avatarUrl TEXT,
  avatarLocalPath TEXT,  -- Path to downloaded avatar image
  avatarDataURI TEXT,    -- Small base64 data URI for quick display
  description TEXT,
  savedAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX idx_profile_handle ON profile(handle);

-- Posts (user's own posts and reposts)
CREATE TABLE post (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uri TEXT NOT NULL UNIQUE,
  cid TEXT NOT NULL,
  authorDid TEXT NOT NULL,

  -- Post content
  text TEXT NOT NULL,
  facetsJSON TEXT,       -- JSON array of rich text facets (mentions, links, hashtags)
  embedType TEXT,        -- 'images', 'video', 'external', 'record', 'recordWithMedia', null
  embedJSON TEXT,        -- JSON representation of embed data
  langs TEXT,            -- Comma-separated language codes

  -- Reply info
  isReply INTEGER NOT NULL DEFAULT 0,
  replyParentUri TEXT,
  replyRootUri TEXT,

  -- Quote post info
  isQuote INTEGER NOT NULL DEFAULT 0,
  quotedPostUri TEXT,

  -- Repost info (if this is a repost by the user)
  isRepost INTEGER NOT NULL DEFAULT 0,
  repostUri TEXT,        -- The user's repost record URI
  repostCid TEXT,
  originalPostUri TEXT,  -- URI of the original post being reposted

  -- Engagement counts (at time of indexing)
  likeCount INTEGER DEFAULT 0,
  repostCount INTEGER DEFAULT 0,
  replyCount INTEGER DEFAULT 0,
  quoteCount INTEGER DEFAULT 0,

  -- Viewer state (at time of indexing)
  viewerLiked INTEGER DEFAULT 0,
  viewerReposted INTEGER DEFAULT 0,
  viewerBookmarked INTEGER DEFAULT 0,

  -- Timestamps
  createdAt TEXT NOT NULL,     -- ISO timestamp from record
  savedAt INTEGER NOT NULL,  -- Unix ms when we saved it

  -- Archival status
  archivedAt INTEGER,          -- When we downloaded media

  -- Deletion tracking
  deletedPostAt INTEGER,       -- When we deleted the post
  deletedRepostAt INTEGER,     -- When we deleted the repost
  deletedLikeAt INTEGER,       -- When we deleted our like on this post
  deletedBookmarkAt INTEGER,   -- When we deleted our bookmark

  FOREIGN KEY (authorDid) REFERENCES profile(did)
);

CREATE INDEX idx_post_author ON post(authorDid);
CREATE INDEX idx_post_created ON post(createdAt);
CREATE INDEX idx_post_is_repost ON post(isRepost);
CREATE INDEX idx_post_viewer_liked ON post(viewerLiked);
CREATE INDEX idx_post_viewer_bookmarked ON post(viewerBookmarked);

-- Post media (images, videos attached to posts)
CREATE TABLE post_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  postUri TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,  -- Order in multi-image posts

  -- Media info
  mediaType TEXT NOT NULL,   -- 'image', 'video'
  blobCid TEXT NOT NULL,
  mimeType TEXT,
  alt TEXT,                  -- Alt text for accessibility

  -- Dimensions
  width INTEGER,
  height INTEGER,
  aspectRatioWidth INTEGER,
  aspectRatioHeight INTEGER,

  -- URLs from API
  thumbUrl TEXT,
  fullsizeUrl TEXT,
  playlistUrl TEXT,          -- For videos

  -- Local storage
  localThumbPath TEXT,
  localFullsizePath TEXT,
  localVideoPath TEXT,

  downloadedAt INTEGER,

  FOREIGN KEY (postUri) REFERENCES post(uri),
  UNIQUE(postUri, position)
);

CREATE INDEX idx_post_media_post ON post_media(postUri);

-- External links embedded in posts
CREATE TABLE post_external (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  postUri TEXT NOT NULL UNIQUE,
  uri TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbUrl TEXT,
  thumbLocalPath TEXT,

  FOREIGN KEY (postUri) REFERENCES post(uri)
);

-- Likes (posts the user has liked)
CREATE TABLE like_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uri TEXT NOT NULL UNIQUE,        -- The like record URI (at://did/app.bsky.feed.like/xxx)
  cid TEXT NOT NULL,
  subjectUri TEXT NOT NULL,        -- The post being liked
  subjectCid TEXT NOT NULL,

  -- Denormalized post info for display without joins
  postAuthorDid TEXT,
  postAuthorHandle TEXT,
  postText TEXT,

  createdAt TEXT NOT NULL,
  savedAt INTEGER NOT NULL,
  deletedAt INTEGER,

  FOREIGN KEY (subjectUri) REFERENCES post(uri)
);

CREATE INDEX idx_like_subject ON like_record(subjectUri);
CREATE INDEX idx_like_created ON like_record(createdAt);

-- Bookmarks
CREATE TABLE bookmark (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subjectUri TEXT NOT NULL UNIQUE,  -- The post URI that is bookmarked
  subjectCid TEXT NOT NULL,

  -- Denormalized post info for display
  postAuthorDid TEXT,
  postAuthorHandle TEXT,
  postText TEXT,
  postCreatedAt TEXT,

  savedAt INTEGER NOT NULL,
  deletedAt INTEGER
);

CREATE INDEX idx_bookmark_created ON bookmark(postCreatedAt);

-- Following list
CREATE TABLE follow (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uri TEXT NOT NULL UNIQUE,         -- The follow record URI
  cid TEXT NOT NULL,
  subjectDid TEXT NOT NULL,         -- The account being followed

  -- Denormalized profile info
  handle TEXT NOT NULL,
  displayName TEXT,
  avatarUrl TEXT,
  avatarLocalPath TEXT,
  avatarDataURI TEXT,

  createdAt TEXT NOT NULL,
  savedAt INTEGER NOT NULL,
  unfollowedAt INTEGER,

  FOREIGN KEY (subjectDid) REFERENCES profile(did)
);

CREATE INDEX idx_follow_subject ON follow(subjectDid);
CREATE INDEX idx_follow_handle ON follow(handle);

-- Chat conversations
CREATE TABLE conversation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  convoId TEXT NOT NULL UNIQUE,
  rev TEXT,

  -- Participants (JSON array of DIDs)
  memberDids TEXT NOT NULL,

  -- Status
  muted INTEGER NOT NULL DEFAULT 0,
  status TEXT,             -- 'request', 'accepted'
  unreadCount INTEGER DEFAULT 0,

  -- Last message preview
  lastMessageId TEXT,
  lastMessageText TEXT,
  lastMessageSentAt TEXT,
  lastMessageSenderDid TEXT,

  savedAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  leftAt INTEGER           -- When we left this conversation
);

CREATE INDEX idx_conversation_updated ON conversation(updatedAt);

-- Chat messages
CREATE TABLE message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  messageId TEXT NOT NULL UNIQUE,
  convoId TEXT NOT NULL,
  rev TEXT,

  -- Sender
  senderDid TEXT NOT NULL,

  -- Content
  text TEXT NOT NULL,
  facetsJSON TEXT,         -- Rich text facets
  embedJSON TEXT,          -- Embedded record, if any

  sentAt TEXT NOT NULL,
  savedAt INTEGER NOT NULL,
  deletedAt INTEGER,

  FOREIGN KEY (convoId) REFERENCES conversation(convoId),
  FOREIGN KEY (senderDid) REFERENCES profile(did)
);

CREATE INDEX idx_message_convo ON message(convoId);
CREATE INDEX idx_message_sender ON message(senderDid);
CREATE INDEX idx_message_sent ON message(sentAt);
```

### Key Design Decisions

1. **Denormalized Data**: Post text and author info are copied into like_record and bookmark tables to enable display without joins, improving performance on mobile.

2. **Local Media Storage**: Each media item has both URL fields (from API) and local path fields. Media is downloaded upon saving, not lazily.

3. **Soft Deletes**: `deletedAt` timestamps track when items were deleted, allowing the archive to show what was deleted and when.

4. **Facets as JSON**: Rich text facets (mentions, links, hashtags) are stored as JSON strings since they're rendered as a unit.

5. **Profile Caching**: The `profile` table caches author info to avoid redundant API calls and for offline display.

6. **Avatar Data URIs**: Small base64 data URIs are stored for quick inline display; full avatars are downloaded separately.

---

## Controller Lifecycle

### Initialization Flow

1. User selects account from AccountSelectionScreen
2. Navigate to account detail screen with `accountId` param
3. Account detail screen creates/retrieves BlueskyAccountController
4. Controller loads account from main DB, initializes account-specific DB
5. Controller initializes @atproto Agent with stored OAuth session
6. Controller is available to all tabs via context

### React Integration

```typescript
// hooks/useBlueskyController.ts
import { createContext, useContext } from 'react';

const BlueskyControllerContext = createContext<BlueskyAccountController | null>(null);

export function BlueskyControllerProvider({
  accountId,
  children
}: {
  accountId: number;
  children: React.ReactNode;
}) {
  const [controller, setController] = useState<BlueskyAccountController | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const ctrl = new BlueskyAccountController(accountId);
        await ctrl.initDB();
        await ctrl.initAgent();
        if (mounted) {
          setController(ctrl);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      controller?.cleanup();
    };
  }, [accountId]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <BlueskyControllerContext.Provider value={controller}>
      {children}
    </BlueskyControllerContext.Provider>
  );
}

export function useBlueskyController() {
  const controller = useContext(BlueskyControllerContext);
  if (!controller) {
    throw new Error('useBlueskyController must be used within BlueskyControllerProvider');
  }
  return controller;
}
```

### Usage in Tabs

```typescript
// app/account/tabs/save-tab.tsx
function SaveTab() {
  const controller = useBlueskyController();
  const [progress, setProgress] = useState(controller.progress);

  async function handleSavePosts() {
    await controller.indexPosts();
  }

  // ...
}
```

---

## API Data Structures Reference

### PostView (from app.bsky.feed.defs)

```typescript
interface PostView {
  uri: string;
  cid: string;
  author: ProfileViewBasic;
  record: PostRecord; // { text, facets, reply?, embed?, langs?, createdAt }
  embed?:
    | ImagesView
    | VideoView
    | ExternalView
    | RecordView
    | RecordWithMediaView;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  quoteCount?: number;
  savedAt: string;
  viewer?: ViewerState; // { repost?, like?, bookmarked?, threadMuted?, ... }
  labels?: Label[];
}
```

### FeedViewPost (from app.bsky.feed.getAuthorFeed)

```typescript
interface FeedViewPost {
  post: PostView;
  reply?: ReplyRef;
  reason?: ReasonRepost | ReasonPin; // ReasonRepost indicates this is a repost
}
```

### MessageView (from chat.bsky.convo.defs)

```typescript
interface MessageView {
  id: string;
  rev: string;
  text: string;
  facets?: RichtextFacet[];
  embed?: RecordView;
  reactions?: ReactionView[];
  sender: { did: string };
  sentAt: string;
}
```

### ConvoView (from chat.bsky.convo.defs)

```typescript
interface ConvoView {
  id: string;
  rev: string;
  members: ProfileViewBasic[];
  lastMessage?: MessageView | DeletedMessageView;
  muted: boolean;
  status?: "request" | "accepted";
  unreadCount: number;
}
```

### ProfileViewBasic (from app.bsky.actor.defs)

```typescript
interface ProfileViewBasic {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  viewer?: ViewerState;
  labels?: Label[];
}
```

---

## Implementation Order

### Phase 1: Foundation

1. Create `BaseAccountController` class
2. Create account database module with migrations
3. Create `BlueskyAccountController` skeleton
4. Create `BlueskyControllerProvider` context

### Phase 2: Save Operations

1. Implement `savePosts()` - paginate through getAuthorFeed
2. Implement `saveLikes()` - paginate through getActorLikes
3. Implement `saveBookmarks()` - paginate through getBookmarks
4. Implement `saveFollowing()` - paginate through getFollows
5. Implement `saveConversations()` - list all convos
6. Implement `saveMessages()` - get messages for each convo

### Phase 3: Media Download

1. Implement `downloadMedia()` - fetch blobs via getBlob
2. Add background media download option
3. Store media in device file system

### Phase 4: Delete Operations

1. Implement `deletePosts()` with filtering options
2. Implement `deleteReposts()`
3. Implement `deleteLikes()`
4. Implement `deleteBookmarks()`
5. Implement `deleteMessages()`
6. Implement `unfollowAll()`

### Phase 5: UI Integration

1. Wire up SaveTab with controller
2. Wire up DeleteTab with controller
3. Wire up BrowseTab with database queries
4. Add progress indicators and error handling

---

## Session Management & OAuth Refresh

### Strategy

The controller must handle OAuth session expiration gracefully during long-running operations. When a session expires:

1. **Pause** the current operation
2. **Show dialog** to re-authenticate
3. **Resume** operation after successful re-auth
4. **Always persist** the latest OAuth credentials

### Implementation

```typescript
// BlueskyAccountController.ts
class BlueskyAccountController extends BaseAccountController<BlueskyProgress> {
  private sessionExpiredCallback?: () => Promise<void>;

  setSessionExpiredCallback(callback: () => Promise<void>) {
    this.sessionExpiredCallback = callback;
  }

  private async makeAuthenticatedRequest<T>(
    requestFn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      if (this.isSessionExpiredError(error)) {
        // Pause operation, notify UI
        this.progress.currentAction = "Waiting for re-authentication...";
        this.progress.isRunning = false;

        if (this.sessionExpiredCallback) {
          await this.sessionExpiredCallback();
          // After re-auth, retry the request
          return await requestFn();
        } else {
          throw new Error("Session expired and no callback provided");
        }
      }
      throw error;
    }
  }

  private isSessionExpiredError(error: any): boolean {
    // Check for 401 Unauthorized or specific atproto error codes
    return (
      error?.status === 401 ||
      error?.error === "ExpiredToken" ||
      error?.message?.includes("token")
    );
  }

  async refreshSession(newSession: OAuthSession): Promise<void> {
    this.session = newSession;
    await this.initAgent(); // Reinitialize agent with new session

    // Persist updated session to main database
    await this.saveSessionToDatabase(newSession);
  }

  private async saveSessionToDatabase(session: OAuthSession): Promise<void> {
    const db = await getDatabase(); // Main app database
    await db.runAsync(
      `UPDATE bsky_account 
       SET sessionJson = ?, 
           accessJwt = ?, 
           refreshJwt = ?,
           updatedAt = ?
       WHERE id = (
         SELECT bskyAccountID FROM account WHERE id = ?
       )`,
      [
        JSON.stringify(session),
        null, // We don't persist raw tokens, only the session
        null,
        Date.now(),
        this.accountId,
      ],
    );
  }
}
```

### UI Integration

```typescript
// In BlueskyControllerProvider or account screen
function AccountScreen({ accountId }: { accountId: number }) {
  const [showReauthDialog, setShowReauthDialog] = useState(false);
  const controller = useBlueskyController();

  useEffect(() => {
    controller?.setSessionExpiredCallback(async () => {
      setShowReauthDialog(true);
      // Wait for re-authentication
      return new Promise((resolve) => {
        // Will be resolved by successful auth in modal
        reauthResolveRef.current = resolve;
      });
    });
  }, [controller]);

  async function handleReauth() {
    // Open OAuth flow modal
    const newSession = await authenticateBlueskyAccount();
    await controller?.refreshSession(newSession);
    setShowReauthDialog(false);
    // Resolve the promise to resume operations
    reauthResolveRef.current?.();
  }

  return (
    <>
      {/* Account UI */}
      <ReauthDialog
        visible={showReauthDialog}
        onReauth={handleReauth}
      />
    </>
  );
}
```

---

## Rate Limit Handling

### Bluesky Rate Limits (as of Dec 2025)

Based on [Bluesky Rate Limit Documentation](https://docs.bsky.app/docs/advanced-guides/rate-limits):

**Hosted Account (PDS) Limits:**

- Overall API Requests (all endpoints): 3000 per 5 minutes (by IP)
- createSession: 30 per 5 minutes, 300 per day (by account)
- Other specific endpoints have lower limits

**Content Write Operations (per account):**

- 5,000 points per hour, 35,000 points per day
- CREATE: 3 points, UPDATE: 2 points, DELETE: 1 point

**Rate Limit Headers:**
Bluesky returns standard [IETF rate limit headers](https://www.ietf.org/archive/id/draft-polli-ratelimit-headers-02.html):

- `RateLimit-Limit`: Maximum requests allowed in window
- `RateLimit-Remaining`: Requests remaining
- `RateLimit-Reset`: Unix timestamp when limit resets

**HTTP 429 Response:**
When rate limited, API returns HTTP 429 "Too Many Requests"

### Strategy

1. **Track rate limits** from response headers
2. **Preemptive throttling** when approaching limits
3. **Automatic retry** when rate limited with countdown
4. **Show UI feedback** during rate limit waits

### Implementation

```typescript
// BlueskyAccountController.ts

interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp (seconds)
  isLimited: boolean;
}

class BlueskyAccountController extends BaseAccountController<BlueskyProgress> {
  private rateLimitInfo: RateLimitInfo = {
    limit: 3000,
    remaining: 3000,
    resetAt: 0,
    isLimited: false,
  };

  private rateLimitCallback?: (info: RateLimitInfo) => void;

  setRateLimitCallback(callback: (info: RateLimitInfo) => void) {
    this.rateLimitCallback = callback;
  }

  private updateRateLimitFromHeaders(headers: Record<string, string>) {
    const limit = headers["ratelimit-limit"];
    const remaining = headers["ratelimit-remaining"];
    const reset = headers["ratelimit-reset"];

    if (limit) this.rateLimitInfo.limit = parseInt(limit, 10);
    if (remaining) this.rateLimitInfo.remaining = parseInt(remaining, 10);
    if (reset) this.rateLimitInfo.resetAt = parseInt(reset, 10);

    // Notify UI of rate limit status
    if (this.rateLimitCallback) {
      this.rateLimitCallback(this.rateLimitInfo);
    }
  }

  private async handleRateLimit(error: any): Promise<void> {
    if (error?.status !== 429) return;

    // Extract reset time from error or headers
    let resetAt = this.rateLimitInfo.resetAt;
    if (!resetAt || resetAt < Date.now() / 1000) {
      // Default to 5 minutes if no reset time available
      resetAt = Math.floor(Date.now() / 1000) + 300;
    }

    this.rateLimitInfo.isLimited = true;
    this.rateLimitInfo.resetAt = resetAt;

    const waitSeconds = resetAt - Math.floor(Date.now() / 1000);

    // Update progress with countdown
    this.progress.currentAction = `Rate limited. Resuming in ${waitSeconds}s...`;

    // Notify UI
    if (this.rateLimitCallback) {
      this.rateLimitCallback(this.rateLimitInfo);
    }

    // Wait until rate limit expires with countdown updates
    await this.waitForRateLimitReset(resetAt);

    this.rateLimitInfo.isLimited = false;
    this.progress.currentAction = "Resuming...";
  }

  private async waitForRateLimitReset(resetAt: number): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = resetAt - now;

        if (remaining <= 0) {
          clearInterval(checkInterval);
          resolve();
        } else {
          // Update progress with countdown
          this.progress.currentAction = `Rate limited. Resuming in ${remaining}s...`;
          if (this.rateLimitCallback) {
            this.rateLimitCallback({
              ...this.rateLimitInfo,
              resetAt,
            });
          }
        }
      }, 1000); // Update every second
    });
  }

  private async makeApiRequest<T>(
    requestFn: () => Promise<{ data: T; headers?: Record<string, string> }>,
  ): Promise<T> {
    try {
      // Check if we're rate limited before making request
      if (this.rateLimitInfo.isLimited) {
        await this.handleRateLimit({ status: 429 });
      }

      const response = await requestFn();

      // Update rate limit tracking from response headers
      if (response.headers) {
        this.updateRateLimitFromHeaders(response.headers);
      }

      return response.data;
    } catch (error) {
      // Handle rate limit errors
      if (error?.status === 429) {
        await this.handleRateLimit(error);
        // Retry after waiting
        return this.makeApiRequest(requestFn);
      }
      throw error;
    }
  }

  // Example usage in save operation
  async savePosts(): Promise<void> {
    let cursor: string | undefined;

    while (true) {
      const response = await this.makeApiRequest(() =>
        this.agent!.app.bsky.feed.getAuthorFeed({
          actor: this.session!.did,
          limit: 100,
          cursor,
        }),
      );

      // Process posts...

      if (!response.cursor) break;
      cursor = response.cursor;
    }
  }
}
```

### UI Integration

```typescript
// In save/delete tabs
function SaveTab() {
  const controller = useBlueskyController();
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);

  useEffect(() => {
    controller?.setRateLimitCallback(setRateLimitInfo);
  }, [controller]);

  return (
    <View>
      {rateLimitInfo?.isLimited && (
        <RateLimitBanner
          resetAt={rateLimitInfo.resetAt}
          remaining={rateLimitInfo.remaining}
          limit={rateLimitInfo.limit}
        />
      )}
      {/* Rest of UI */}
    </View>
  );
}
```

---

## Testing Strategy

### Overview

Introduce comprehensive testing using Jest and React Native Testing Library. Tests should cover:

1. **Unit tests** for controllers, database operations, utilities
2. **Integration tests** for component behavior with controllers
3. **Database tests** for schema and migrations

### Setup

Install testing dependencies:

```bash
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native
```

Configure Jest in `package.json`:

```json
{
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ],
    "setupFilesAfterEnv": ["<rootDir>/jest-setup.ts"],
    "collectCoverageFrom": [
      "**/*.{ts,tsx}",
      "!**/*.d.ts",
      "!**/coverage/**",
      "!**/node_modules/**",
      "!**/.expo/**"
    ]
  }
}
```

Create `jest-setup.ts`:

```typescript
import "@testing-library/jest-native/extend-expect";

// Mock expo-router
jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
  Stack: { Screen: "Screen" },
}));

// Mock expo-sqlite
jest.mock("expo-sqlite/next", () => ({
  openDatabaseAsync: jest.fn(),
}));
```

### Test Structure

```
cyd-mobile/
├── __tests__/
│   ├── controllers/
│   │   ├── BaseAccountController.test.ts
│   │   └── BlueskyAccountController.test.ts
│   ├── database/
│   │   ├── migrations.test.ts
│   │   └── account-db.test.ts
│   ├── components/
│   │   ├── CydAvatar.test.tsx
│   │   └── SpeechBubble.test.tsx
│   └── integration/
│       ├── account-flow.test.tsx
│       └── save-operations.test.tsx
└── testUtils/
    ├── mockController.ts
    ├── mockDatabase.ts
    └── testProviders.tsx
```

### Phase 0: Initial Testing Setup

1. **Install dependencies** and configure Jest
2. **Create test utilities**:
   - Mock controller factory
   - Mock database factory
   - Test providers wrapper
3. **Write tests for existing code**:
   - Database migrations
   - Account CRUD operations
   - OAuth flow
   - Component tests (CydAvatar, SpeechBubble, etc.)

#### Example Test Utilities

```typescript
// testUtils/mockDatabase.ts
export async function createMockDatabase(): Promise<SQLiteDatabase> {
  return {
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    withTransactionAsync: jest.fn(),
  } as any;
}

// testUtils/mockController.ts
export function createMockBlueskyController(
  overrides?: Partial<BlueskyAccountController>
): BlueskyAccountController {
  return {
    accountId: 1,
    savePosts: jest.fn(),
    saveLikes: jest.fn(),
    deletePosts: jest.fn(),
    getProgress: jest.fn(() => ({
      postsIndexed: 0,
      postsTotal: 0,
      // ... other progress fields
    })),
    ...overrides,
  } as any;
}

// testUtils/testProviders.tsx
export function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

#### Example Component Test

```typescript
// __tests__/components/CydAvatar.test.tsx
import { render } from '@testing-library/react-native';
import { CydAvatar } from '@/components/cyd/CydAvatar';

describe('CydAvatar', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<CydAvatar height={140} />);
    expect(getByTestId('cyd-avatar')).toBeTruthy();
  });

  it('cycles through stances', async () => {
    jest.useFakeTimers();
    const { getByTestId } = render(<CydAvatar height={140} />);

    // Fast-forward time to trigger stance change
    jest.advanceTimersByTime(6000);

    // Verify stance changed
    // (would need to expose stance for testing or test via snapshots)
  });
});
```

#### Example Database Test

```typescript
// __tests__/database/migrations.test.ts
import { openDatabaseAsync } from "expo-sqlite/next";
import { migrations } from "@/database/migrations";

describe("Database Migrations", () => {
  it("applies migrations in order", async () => {
    const db = await openDatabaseAsync(":memory:");

    for (const migration of migrations) {
      await db.withTransactionAsync(async () => {
        for (const statement of migration.statements) {
          await db.execAsync(statement);
        }
        await db.execAsync(`PRAGMA user_version = ${migration.version};`);
      });
    }

    const version = await db.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version;",
    );
    expect(version?.user_version).toBe(
      migrations[migrations.length - 1].version,
    );
  });

  it("creates expected tables", async () => {
    const db = await openDatabaseAsync(":memory:");
    // Apply migrations...

    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table';",
    );

    expect(tables.map((t) => t.name)).toContain("account");
    expect(tables.map((t) => t.name)).toContain("bsky_account");
  });
});
```

### Testing for Each Implementation Phase

Update each phase to include testing:

**Phase 1: Foundation**

- Unit tests for `BaseAccountController`
- Unit tests for database factory
- Unit tests for migrations
- Integration test for controller initialization

**Phase 2: Save Operations**

- Mock API responses from Bluesky
- Unit test each save function
- Test pagination logic
- Test data transformation and storage
- Test error handling and retries

**Phase 3: Media Download**

- Mock file system operations
- Test blob download and storage
- Test concurrent download handling
- Test storage path generation

**Phase 4: Delete Operations**

- Mock API delete calls
- Test filtering logic
- Test batch deletion
- Test deletion tracking in database

**Phase 5: UI Integration**

- Component tests with Testing Library
- Test user interactions
- Test progress display
- Test error states
