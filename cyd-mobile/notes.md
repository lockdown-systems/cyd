atproto API docs are here: https://docs.bsky.app/docs/category/http-reference

Here are some of the relevant endpoints:

- `app.bsky.actor.getProfile`: Get the display name, avatar, etc. of the user
- `app.bsky.feed.getActorLikes`: Get the user's likes
- `app.bsky.feed.getAuthorFeed`: Get the user's posts and reposts
- `app.bsky.graph.getFollows`: Get list of accounts the user follows
- `chat.bsky.convo.listConvos`: List all chat conversations
- `chat.bsky.convo.getConvo`: Get a chat conversation
- `chat.bsky.convo.leaveConvo`: Leave a chat conversation
- `chat.bsky.convo.deleteMessageForSelf`: Delete a chat message
- `com.atproto.sync.getBlob`: Download an uploaded blob
- `app.bsky.bookmark.getBookmarks`: Get the user's bookmarks
- `app.bsky.bookmark.deleteBookmark`: Delete a bookmark

Local database options

- Save my posts
- Save my likes
- Save my bookmarks
- Save my chat messages
- Save my following list

Delete options

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
