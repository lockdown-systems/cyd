# Validate Bluesky version 2 archive integrity before import

Bluesky version 2 archives include a manifest listing every payload file's path, byte size, and SHA-256 digest, and export captures a point-in-time-consistent database and media snapshot. Import validates the complete manifest before mutating local data and applies the merge transactionally, preventing corrupt or partial packages from producing partially imported accounts.
