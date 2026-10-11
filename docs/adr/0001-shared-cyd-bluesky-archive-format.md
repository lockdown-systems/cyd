# ADR 0001: Shared Cyd Bluesky archive format

Cyd and Cyd Mobile share one Bluesky archive format for import, export, and
recovery. The normative contract is `docs/archive/bluesky/v2/` in this repo —
its README, SQLite schema, and canonical fixtures are the single source of
truth, mirrored into Cyd Mobile as a pinned contract bundle. Conformance is
enforced by tests in both repos, not by prose.
