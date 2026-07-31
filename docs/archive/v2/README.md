# Cyd archive format version 2

This directory is the normative contract for the first cross-client Cyd
archive. “Must”, “must not”, “required”, “should”, and “may” are used in their
RFC 2119 sense.

## Package

A v2 archive is a plaintext, self-contained ZIP file. Its filename and file
extension are not authoritative. Readers identify it from `metadata.json`.
All ZIP entry names are UTF-8, `/`-separated, normalized relative paths. An
archive has exactly this layout:

```text
metadata.json
manifest.json
data.db
media/sha256/<first-two-hex>/<64-lowercase-hex-digest>
```

Directories may be explicit or implicit. Every other entry is forbidden.
Entries must be regular files or directories: symlinks, hard links, devices,
absolute paths, drive-qualified paths, `.`/`..` segments, backslashes,
duplicate normalized names, and encrypted ZIP entries are forbidden.

`metadata.json` is UTF-8 JSON with this exact shape (unknown fields are
reserved and must be ignored):

```json
{
  "format": "cyd-archive",
  "version": 2,
  "createdAt": "2026-01-15T12:00:00.000Z",
  "accountDid": "did:plc:examplealice",
  "accountUuid": "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
  "completeness": "complete"
}
```

Times use RFC 3339 UTC with milliseconds. `completeness` is `complete` only
when every expected asset is available; otherwise it is `incomplete`. The
metadata identity, UUID, creation time, and completeness must equal the single
row in `data.db.archive`.

## Integrity manifest

`manifest.json` is UTF-8 JSON:

```json
{
  "algorithm": "sha256",
  "payloads": [
    { "path": "data.db", "bytes": 1234, "sha256": "…64 lowercase hex…" }
  ]
}
```

It lists every regular payload except itself exactly once, sorted by path.
Each entry contains its normalized path, uncompressed byte length, and SHA-256
of its bytes. Readers must validate the complete manifest before exposing an
import preview or mutating live data. `metadata.json` and `data.db` are payloads.
Media paths must end in their digest and their bytes must match that digest.

Readers extract into an isolated staging directory while validating entry
type, path, declared and expanded sizes, entry counts, free space, and digest.
They must not follow links or write outside staging. There is no small fixed
archive-size limit; clients may require explicit confirmation at documented
resource thresholds. Failure or cancellation leaves the live account unchanged.

## Interchange database

`data.db` is SQLite 3 and must implement [schema.sql](schema.sql) exactly for
v2. It is an interchange model, never a copy of a client's runtime database.
Text is UTF-8. Booleans are integers constrained to `0` or `1`. JSON columns
contain canonical JSON values rather than client-specific serialized objects.

The model has these semantic groups:

- `archive`, `identity`, and `profiles`: local UUID, durable DID, current
  profile, and captured historical author profiles.
- `records`, `selections`, `record_subjects`, and `record_context`: the latest
  observed form of posts/reposts/likes/bookmarks, the selected relationship's
  target record, plus direct reply-parent, quote, external, and author context.
  Context is bounded; it does not recursively capture threads.
- `conversations`, `conversation_members`, and `messages`: direct-message
  context, membership, and messages.
- `relationships`: follows, blocks, and mutes with source-deletion state.
- `assets` and `record_assets`: every expected image, preview, thumbnail, and
  full video, including unavailable assets and their reason.
- `portable_settings`: portable save defaults and source-delete defaults.

Stable AT URIs identify records; DIDs identify Bluesky identities. `cid` is
the latest observed CID, not revision history. `observed_at`,
`source_deleted_at`, and captured profiles preserve observation and deletion
state. An unavailable asset has no digest or archive path, remains referenced,
and makes the archive incomplete. Every available asset has a unique digest,
byte count, media type, and content-addressed payload.

All five selection categories—`posts`, `reposts`, `likes`, `bookmarks`, and
`chats`—must be representable. Category selection pulls its required direct
context and media with it. Import merges records by stable identifiers,
retains local data absent from the archive, prefers newer non-empty
observations, and is idempotent. It may restore locally deleted data.

## Completeness and consistency

Export is a point-in-time-consistent snapshot of the selected account data and
media. Each archive stands alone; v2 has no delta or predecessor mechanism.
A structurally valid archive may be incomplete. Missing expected media must be
represented as `unavailable` or `missing`, never silently omitted. The archive
and metadata completeness is `complete` if and only if all asset rows are
`available` and every referenced payload validates.

## Privacy boundary

Only portable account data belongs in v2. Archives must not contain OAuth or
other credentials, private keys, sessions, schedules, pending/running/history
jobs, logs, analytics, diagnostics, error reports, caches, temporary data,
filesystem paths, or UI state. Portable settings are defaults, not authority
to schedule or execute work, and do not overwrite an existing account unless
the user explicitly chooses to adopt them.

## Version behavior

Desktop imports and exports v2 only. It rejects the historical unversioned
mobile format explicitly as `unsupported legacy format`; it never guesses v1
from a filename. It rejects a valid internal version greater than 2 explicitly
as `unsupported newer archive version`. It rejects invalid v2 content as an
invalid or corrupt archive, which is distinct from version rejection. Desktop
writers must emit only v2. Readers must ship and pass the canonical semantic
fixtures before v2 writing is release-enabled.

## Canonical fixtures

`fixtures/complete.cyd` and `fixtures/incomplete.cyd` are canonical semantic
examples generated by `scripts/generate.py`. They cover every category,
captured/current profiles, reply/quote/external context, relationships,
observations, deletion state, chats, settings, images, previews, video
thumbnails, and a full video payload. The incomplete fixture differs by one
expected unavailable full-video asset. Expectations are machine-readable in
`fixtures/semantic-expectations.json`.

Consumers compare normalized database meaning, asset digests, completeness,
and rejection outcomes—not ZIP bytes, entry order, or SQLite page layout.

## Version history

| Version            | Status      | Meaning                                                                                                                       |
| ------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Unversioned (“v1”) | Unsupported | Historical Mobile-only archive format; never a cross-client contract.                                                         |
| 2                  | Current     | First Cyd archive contract supported for Desktop/Mobile interchange. Plaintext ZIP and canonical SQLite interchange database. |

Future versions must append an entry here and define explicit reader behavior.
Version meaning must never be inferred from a filename.
