# Encrypt credentials, not saved content

The initial desktop Bluesky release does not add application-level encryption for runtime databases, chats, or media; saved content relies on operating-system account permissions and disk encryption, and Cyd must not create broader file permissions. OAuth credentials remain the exception and require protected persistence as defined separately, because they authorize account control rather than merely exposing a local backup.
