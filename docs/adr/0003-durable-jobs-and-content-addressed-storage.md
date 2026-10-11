# ADR 0003: Durable jobs and content-addressed storage

Bluesky save, delete, import, and export operations are durable, resumable,
and idempotent: they commit progress incrementally, recover after restart,
and leave existing account data untouched until final commit. Storage keeps
the latest observed record at its stable AT URI (not every historical
revision), and stores media content-addressably within each local account,
with saved records referencing assets rather than owning duplicate files.
Disabling a save category affects future collection only, never deleting
previously saved records; local deletion is a separate explicit action.
