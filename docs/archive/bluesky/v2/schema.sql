PRAGMA application_id = 0x43594232;
PRAGMA user_version = 2;
PRAGMA foreign_keys = ON;

CREATE TABLE archive (
  format TEXT NOT NULL CHECK (format = 'cyd-archive'),
  platform TEXT NOT NULL CHECK (platform = 'bluesky'),
  version INTEGER NOT NULL CHECK (version = 2),
  created_at TEXT NOT NULL,
  account_did TEXT NOT NULL,
  account_uuid TEXT NOT NULL,
  completeness TEXT NOT NULL CHECK (completeness IN ('complete', 'incomplete'))
);

CREATE TABLE identity (
  did TEXT PRIMARY KEY,
  current_profile_id TEXT NOT NULL
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  handle TEXT,
  display_name TEXT,
  description TEXT,
  avatar_asset_id TEXT REFERENCES assets(id),
  banner_asset_id TEXT REFERENCES assets(id),
  captured_at TEXT NOT NULL
);

CREATE TABLE records (
  uri TEXT PRIMARY KEY,
  cid TEXT,
  record_type TEXT NOT NULL,
  author_profile_id TEXT NOT NULL REFERENCES profiles(id),
  indexed_at TEXT,
  created_at TEXT NOT NULL,
  first_observed_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  source_deleted_at TEXT,
  text TEXT,
  facets_json TEXT,
  payload_json TEXT NOT NULL
);

CREATE TABLE selections (
  category TEXT NOT NULL CHECK (category IN ('posts', 'reposts', 'likes', 'bookmarks', 'chats')),
  subject_id TEXT NOT NULL,
  selected_at TEXT NOT NULL,
  PRIMARY KEY (category, subject_id)
);

CREATE TABLE record_subjects (
  relationship_uri TEXT PRIMARY KEY REFERENCES records(uri),
  subject_record_uri TEXT NOT NULL REFERENCES records(uri)
);

CREATE TABLE record_context (
  record_uri TEXT NOT NULL REFERENCES records(uri),
  kind TEXT NOT NULL CHECK (kind IN ('reply_parent', 'quote', 'external')),
  context_record_uri TEXT,
  context_profile_id TEXT REFERENCES profiles(id),
  external_json TEXT,
  PRIMARY KEY (record_uri, kind)
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  rev TEXT,
  first_observed_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  source_deleted_at TEXT
);

CREATE TABLE conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  PRIMARY KEY (conversation_id, profile_id)
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  sender_profile_id TEXT NOT NULL REFERENCES profiles(id),
  sent_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  source_deleted_at TEXT,
  text TEXT,
  facets_json TEXT,
  payload_json TEXT NOT NULL
);

CREATE TABLE relationships (
  uri TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('follow', 'block', 'mute')),
  actor_did TEXT NOT NULL,
  subject_did TEXT NOT NULL,
  created_at TEXT,
  observed_at TEXT NOT NULL,
  source_deleted_at TEXT
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'preview', 'thumbnail', 'video')),
  media_type TEXT NOT NULL,
  byte_count INTEGER CHECK (byte_count IS NULL OR byte_count >= 0),
  sha256 TEXT UNIQUE CHECK (sha256 IS NULL OR (length(sha256) = 64 AND sha256 = lower(sha256))),
  archive_path TEXT UNIQUE,
  availability TEXT NOT NULL CHECK (availability IN ('available', 'missing', 'unavailable')),
  unavailable_reason TEXT,
  source_url TEXT,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  CHECK (
    (availability = 'available' AND byte_count IS NOT NULL AND sha256 IS NOT NULL AND archive_path IS NOT NULL AND unavailable_reason IS NULL)
    OR
    (availability != 'available' AND byte_count IS NULL AND sha256 IS NULL AND archive_path IS NULL AND unavailable_reason IS NOT NULL)
  )
);

CREATE TABLE record_assets (
  owner_type TEXT NOT NULL CHECK (owner_type IN ('record', 'message', 'profile')),
  owner_id TEXT NOT NULL,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  role TEXT NOT NULL CHECK (role IN ('content', 'preview', 'thumbnail', 'avatar', 'banner')),
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (owner_type, owner_id, role, position)
);

CREATE TABLE portable_settings (
  key TEXT PRIMARY KEY CHECK (key IN (
    'save_posts', 'save_reposts', 'save_likes', 'save_bookmarks', 'save_chats',
    'delete_posts', 'delete_reposts', 'delete_likes', 'delete_bookmarks',
    'delete_chats', 'delete_follows'
  )),
  value_json TEXT NOT NULL
);

CREATE INDEX records_author ON records(author_profile_id);
CREATE INDEX records_observed ON records(observed_at);
CREATE INDEX messages_conversation ON messages(conversation_id, sent_at);
CREATE INDEX assets_availability ON assets(availability);
