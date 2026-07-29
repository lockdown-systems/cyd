# Cyd

Cyd helps people preserve, inspect, and manage the data associated with their social-media accounts.

## Language

**Bluesky workflow parity**:
Mobile and desktop Cyd offer the same Bluesky account-management capabilities and preserve the same data semantics, while each may use platform-appropriate interfaces and operating-system integrations.
_Avoid_: UI parity, identical clients

**Cyd archive**:
A complete, self-contained, versioned snapshot of an account's saved data and media that supported Cyd clients can exchange without losing its meaning. Unversioned mobile Bluesky archives are legacy version 1 archives.
_Avoid_: HTML export, database backup

**Interchange database**:
The canonical representation of structured account data inside a Cyd archive. It is independent of each client's private runtime storage.
_Avoid_: runtime database, mobile database

**Bluesky identity**:
A Bluesky account identified durably by its DID, even when its handle changes or separate Cyd installations know it by different local identifiers.
_Avoid_: handle, Cyd UUID

**Local account**:
A client's local representation of a Bluesky identity, identified within Cyd by a UUID and containing that client's settings and saved data.
_Avoid_: Bluesky identity

**Archive import**:
An idempotent recovery merge of a Cyd archive into a matching local account, preserving the union of saved data while collapsing records that share stable Bluesky identifiers. It may restore data previously removed through local deletion.
_Avoid_: replace, synchronize

**Account settings**:
Local preferences governing how Cyd saves and manages a Bluesky identity. An archive can supply defaults for a new local account, but does not silently override an existing local account's preferences or schedules.
_Avoid_: account data, archive state

**Scheduled reminder**:
A client-local prompt to review and start due account-management work. It does not authorize Cyd to perform deletion unattended.
_Avoid_: scheduled job, automatic deletion, push notification

**Connection**:
A local installation's authorization to act on a Bluesky identity. Connections are established separately on each client and are never part of a Cyd archive.
Disconnecting removes authorization without removing the local account or its saved data.
_Avoid_: account data, imported session, local account

**Saved data**:
The account records and complete media Cyd has preserved locally, including material that may later disappear from Bluesky. When a record is selected for saving, its full media is part of the saved data regardless of the record category.
_Avoid_: live feed, HTML export

**Saved record**:
The latest representation of a Bluesky record observed by Cyd at a stable AT URI, together with its observation timestamps and deletion state. It is not a history of every CID revision.
_Avoid_: record revision, live record

**Browse**:
Inspect saved data inside Cyd without requiring a Bluesky connection or network access.
_Avoid_: view on Bluesky, live feed

**Context snapshot**:
The directly referenced author, reply parent, quoted record, external embed, and other captured information required to render a saved record faithfully without recursively preserving the surrounding social graph.
_Avoid_: full thread, live lookup

**Complete backup**:
A saved dataset or Cyd archive containing every expected asset for its selected records. Missing assets are explicit and make the backup incomplete without invalidating the data that was successfully preserved.
_Avoid_: valid archive, successful export

**Source deletion**:
Removal of a record or relationship from Bluesky while retaining Cyd's saved copy and deletion state.
_Avoid_: local deletion

**Local deletion**:
An explicit removal of saved data from Cyd, independent of whether the source still exists on Bluesky.
_Avoid_: source deletion, stop saving
