#!/usr/bin/env python3
"""Generate the semantic v2 fixtures. ZIP/SQLite bytes are not the contract."""

from __future__ import annotations

import base64
import hashlib
import json
import sqlite3
import struct
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "schema.sql").read_text(encoding="utf-8")
FIXTURES = ROOT / "fixtures"
CREATED = "2026-01-15T12:00:00.000Z"
DID = "did:plc:canonicalalice"
UUID = "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12"

# A real 1x1 PNG. Distinct suffixes are legal trailing ancillary bytes and make
# the canonical image, preview, and thumbnail independently addressable.
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def box(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I4s", len(payload) + 8, kind) + payload


# A small complete ISO-BMFF payload used to prove that video means the offline
# full-video object, not merely its preview or thumbnail.
VIDEO = box(b"ftyp", b"isom\x00\x00\x02\x00isomiso2mp41") + box(
    b"free", b"canonical-cyd-v2-full-video"
) + box(b"mdat", b"\x00\x00\x00\x01\x65\x88\x84canonical-video-sample")


def add_asset(
    db: sqlite3.Connection,
    staging: Path,
    asset_id: str,
    kind: str,
    media_type: str,
    content: bytes | None,
    reason: str | None = None,
) -> None:
    if content is None:
        db.execute(
            "INSERT INTO assets (id, kind, media_type, availability, unavailable_reason, source_url) VALUES (?, ?, ?, 'unavailable', ?, ?)",
            (asset_id, kind, media_type, reason, f"https://cdn.example/{asset_id}"),
        )
        return
    digest = hashlib.sha256(content).hexdigest()
    archive_path = f"media/sha256/{digest[:2]}/{digest}"
    output = staging / archive_path
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(content)
    db.execute(
        "INSERT INTO assets (id, kind, media_type, byte_count, sha256, archive_path, availability, source_url, width, height, alt_text) VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)",
        (
            asset_id,
            kind,
            media_type,
            len(content),
            digest,
            archive_path,
            f"https://cdn.example/{asset_id}",
            1 if kind != "video" else 320,
            1 if kind != "video" else 180,
            f"canonical {kind}",
        ),
    )


def populate(db: sqlite3.Connection, staging: Path, complete: bool) -> None:
    completeness = "complete" if complete else "incomplete"
    db.execute(
        "INSERT INTO archive VALUES ('cyd-archive', 2, ?, ?, ?, ?)",
        (CREATED, DID, UUID, completeness),
    )
    profiles = [
        ("profile-alice-current", DID, "alice.example", "Alice Current", "current profile", CREATED),
        ("profile-alice-captured", DID, "alice.test", "Alice Captured", "captured author", "2025-12-01T09:00:00.000Z"),
        ("profile-bob", "did:plc:canonicalbob", "bob.example", "Bob", "direct context author", CREATED),
    ]
    db.executemany(
        "INSERT INTO profiles (id, did, handle, display_name, description, captured_at) VALUES (?, ?, ?, ?, ?, ?)",
        profiles,
    )
    db.execute("INSERT INTO identity VALUES (?, ?)", (DID, "profile-alice-current"))

    add_asset(db, staging, "asset-image", "image", "image/png", PNG + b"image")
    add_asset(db, staging, "asset-preview", "preview", "image/png", PNG + b"preview")
    add_asset(db, staging, "asset-thumbnail", "thumbnail", "image/png", PNG + b"thumbnail")
    add_asset(
        db,
        staging,
        "asset-video-full",
        "video",
        "video/mp4",
        VIDEO if complete else None,
        "source video was unavailable at export",
    )
    db.execute(
        "UPDATE profiles SET avatar_asset_id = 'asset-image' WHERE id = 'profile-alice-current'"
    )

    record_rows = [
        ("at://did:plc:canonicalalice/app.bsky.feed.post/post", "bafy-post", "app.bsky.feed.post", "profile-alice-captured", "2026-01-01T10:00:00.000Z", None, "Own post with full video"),
        ("at://did:plc:canonicalbob/app.bsky.feed.post/reply", "bafy-reply", "app.bsky.feed.post", "profile-bob", "2025-12-30T10:00:00.000Z", None, "Direct reply parent"),
        ("at://did:plc:canonicalbob/app.bsky.feed.post/quote", "bafy-quote", "app.bsky.feed.post", "profile-bob", "2025-12-29T10:00:00.000Z", "2026-01-10T00:00:00.000Z", "Quoted record later deleted at source"),
        ("at://did:plc:canonicalalice/app.bsky.feed.repost/repost", "bafy-repost", "app.bsky.feed.repost", "profile-alice-captured", "2026-01-02T10:00:00.000Z", None, None),
        ("at://did:plc:canonicalalice/app.bsky.feed.like/like", "bafy-like", "app.bsky.feed.like", "profile-alice-captured", "2026-01-03T10:00:00.000Z", None, None),
        ("at://did:plc:canonicalalice/app.bsky.graph.listitem/bookmark", "bafy-bookmark", "app.cyd.bookmark", "profile-alice-captured", "2026-01-04T10:00:00.000Z", None, None),
    ]
    db.executemany(
        "INSERT INTO records (uri, cid, record_type, author_profile_id, created_at, first_observed_at, observed_at, source_deleted_at, text, facets_json, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '{}')",
        [(uri, cid, record_type, profile, created, created, CREATED, deleted, text) for uri, cid, record_type, profile, created, deleted, text in record_rows],
    )
    post, reply, quote, repost, like, bookmark = [row[0] for row in record_rows]
    selections = [
        ("posts", post),
        ("reposts", repost),
        ("likes", like),
        ("bookmarks", bookmark),
        ("chats", "convo-canonical"),
    ]
    db.executemany("INSERT INTO selections VALUES (?, ?, ?)", [(category, subject, CREATED) for category, subject in selections])
    db.executemany(
        "INSERT INTO record_subjects VALUES (?, ?)",
        [(repost, quote), (like, post), (bookmark, post)],
    )
    db.executemany(
        "INSERT INTO record_context VALUES (?, ?, ?, ?, ?)",
        [
            (post, "reply_parent", reply, "profile-bob", None),
            (post, "quote", quote, "profile-bob", None),
            (post, "external", None, None, '{"title":"Canonical link","uri":"https://example.com/context"}'),
        ],
    )
    db.execute("INSERT INTO conversations VALUES ('convo-canonical', '1', ?, ?, NULL)", (CREATED, CREATED))
    db.executemany(
        "INSERT INTO conversation_members VALUES ('convo-canonical', ?)",
        [("profile-alice-captured",), ("profile-bob",)],
    )
    db.execute(
        "INSERT INTO messages VALUES ('message-canonical', 'convo-canonical', 'profile-bob', ?, ?, NULL, 'Portable direct message', '[]', '{}')",
        ("2026-01-05T10:00:00.000Z", CREATED),
    )
    db.executemany(
        "INSERT INTO relationships VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            ("at://did:plc:canonicalalice/app.bsky.graph.follow/bob", "follow", DID, "did:plc:canonicalbob", CREATED, CREATED, None),
            ("mute:did:plc:canonicalbob", "mute", DID, "did:plc:canonicalbob", CREATED, CREATED, "2026-01-12T00:00:00.000Z"),
        ],
    )
    db.executemany(
        "INSERT INTO record_assets VALUES (?, ?, ?, ?, ?)",
        [
            ("profile", "profile-alice-current", "asset-image", "avatar", 0),
            ("record", post, "asset-image", "content", 0),
            ("record", post, "asset-preview", "preview", 0),
            ("record", post, "asset-thumbnail", "thumbnail", 0),
            ("record", post, "asset-video-full", "content", 1),
        ],
    )
    db.executemany(
        "INSERT INTO portable_settings VALUES (?, ?)",
        [
            ("save_posts", "true"),
            ("save_reposts", "true"),
            ("save_likes", "true"),
            ("save_bookmarks", "true"),
            ("save_chats", "true"),
            ("delete_posts", '{"olderThanDays":30}'),
            ("delete_follows", "false"),
        ],
    )


def generate(name: str, complete: bool) -> None:
    with tempfile.TemporaryDirectory(prefix=f"cyd-v2-{name}-") as temporary:
        staging = Path(temporary)
        metadata = {
            "format": "cyd-archive",
            "version": 2,
            "createdAt": CREATED,
            "accountDid": DID,
            "accountUuid": UUID,
            "completeness": "complete" if complete else "incomplete",
        }
        (staging / "metadata.json").write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        db = sqlite3.connect(staging / "data.db")
        db.executescript(SCHEMA)
        populate(db, staging, complete)
        db.commit()
        result = db.execute("PRAGMA integrity_check").fetchone()[0]
        assert result == "ok", result
        db.close()

        payload_paths = sorted(
            file.relative_to(staging).as_posix()
            for file in staging.rglob("*")
            if file.is_file()
        )
        payloads = []
        for relative in payload_paths:
            content = (staging / relative).read_bytes()
            payloads.append(
                {
                    "path": relative,
                    "bytes": len(content),
                    "sha256": hashlib.sha256(content).hexdigest(),
                }
            )
        (staging / "manifest.json").write_text(
            json.dumps({"algorithm": "sha256", "payloads": payloads}, indent=2) + "\n",
            encoding="utf-8",
        )

        with zipfile.ZipFile(FIXTURES / f"{name}.cyd", "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for relative in sorted(payload_paths + ["manifest.json"]):
                info = zipfile.ZipInfo(relative, (2026, 1, 15, 12, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, (staging / relative).read_bytes(), compresslevel=9)


if __name__ == "__main__":
    FIXTURES.mkdir(parents=True, exist_ok=True)
    generate("complete", complete=True)
    generate("incomplete", complete=False)
