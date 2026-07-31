# Cyd

Cyd helps people preserve, inspect, and manage the data associated with their social-media accounts.

## Language

**Bluesky workflow parity**:
Mobile and desktop Cyd offer the same Bluesky account-management capabilities and preserve the same data semantics, while each may use platform-appropriate interfaces and operating-system integrations.
_Avoid_: UI parity, identical clients

**Cyd archive**:
An export of one social-platform account's saved data. Each platform defines its own archive contents, behavior, compatibility guarantees, and version history, so references to a particular archive must name the platform.
_Avoid_: archive, platform-neutral archive

**Cyd Bluesky archive**:
A Cyd archive governed by the Bluesky archive contract. Version 2 is the first supported Bluesky archive format; the earlier unversioned mobile prototype is not a compatibility surface.
_Avoid_: Cyd archive v2, platform-neutral v2 archive

**Bluesky interchange database**:
The canonical representation of structured Bluesky account data inside a Cyd Bluesky archive. It is independent of each client's private runtime storage.
_Avoid_: interchange database, runtime database, mobile database

**Bluesky identity**:
A Bluesky account identified durably by its DID, even when its handle changes or separate Cyd installations know it by different local identifiers.
_Avoid_: handle, Cyd UUID

**Bluesky local account**:
A client's local representation of a Bluesky identity, identified within Cyd by a UUID and containing that client's Bluesky account settings and Bluesky saved data.
_Avoid_: local account, Bluesky identity

**Bluesky archive import**:
An idempotent recovery merge of a Cyd Bluesky archive into a matching Bluesky local account, preserving the union of Bluesky saved data while collapsing records that share stable Bluesky identifiers. It may restore data previously removed through Bluesky local deletion.
_Avoid_: archive import, replace, synchronize

**Bluesky account settings**:
Local preferences governing how Cyd saves and manages a Bluesky identity. A Cyd Bluesky archive can supply defaults for a new Bluesky local account, but does not silently override an existing Bluesky local account's preferences or schedules.
_Avoid_: account settings, account data, archive state

**Bluesky scheduled reminder**:
A prompt to review and start due Bluesky account-management work. It does not authorize Cyd to perform deletion unattended; clients may use platform-appropriate delivery such as local notifications or server-scheduled push.
_Avoid_: scheduled reminder, scheduled job, automatic deletion

**Bluesky connection**:
A local installation's authorization to act on a Bluesky identity. Bluesky connections are established separately on each client and are never part of a Cyd Bluesky archive.
Disconnecting removes authorization without removing the Bluesky local account or its Bluesky saved data.
_Avoid_: connection, account data, imported session, Bluesky local account

**Bluesky saved data**:
The Bluesky records and complete media Cyd has preserved locally, including material that may later disappear from Bluesky. When a record is selected for saving, its full media is part of the Bluesky saved data regardless of the record category.
_Avoid_: saved data, live feed, HTML export

**Bluesky saved record**:
The latest representation of a Bluesky record observed by Cyd at a stable AT URI, together with its observation timestamps and deletion state. It is not a history of every CID revision.
_Avoid_: saved record, record revision, live record

**Bluesky browse**:
Inspection of Bluesky saved data inside Cyd without requiring a Bluesky connection or network access.
_Avoid_: browse, view on Bluesky, live feed

**Bluesky context snapshot**:
The directly referenced author, reply parent, quoted record, external embed, and other captured information required to render a Bluesky saved record faithfully without recursively preserving the surrounding social graph.
_Avoid_: context snapshot, full thread, live lookup

**Complete Bluesky backup**:
Bluesky saved data or a Cyd Bluesky archive containing every expected asset for its selected records. Missing assets are explicit and make the backup incomplete without invalidating the data that was successfully preserved.
_Avoid_: complete backup, valid archive, successful export

**Bluesky source deletion**:
Removal of a record or relationship from Bluesky while retaining its Bluesky saved record and deletion state in Cyd.
_Avoid_: source deletion, Bluesky local deletion

**Bluesky local deletion**:
An explicit removal of Bluesky saved data from Cyd, independent of whether the source still exists on Bluesky.
_Avoid_: local deletion, Bluesky source deletion, stop saving
