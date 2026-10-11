# ADR 0003: Bluesky durable jobs and content-addressed storage

Bluesky save, delete, import, and export operations are durable, resumable,
and idempotent: they commit progress incrementally, recover after restart,
and leave existing account data untouched until final commit. Bluesky
storage keeps the latest observed record at its stable AT URI (not every
historical revision), and stores media content-addressably within each
Bluesky local account, with saved records referencing assets rather than
owning duplicate files. Disabling a save category affects future collection
only, never deleting previously saved records; local deletion is a separate
explicit action. Other platforms (X, Facebook) follow their own storage
models; this ADR is about Bluesky.
