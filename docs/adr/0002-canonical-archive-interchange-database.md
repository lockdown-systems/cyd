# Canonical Bluesky interchange database

The `data.db` inside Bluesky version 2 and later Cyd Bluesky archives is a canonical Bluesky interchange database rather than a copy of either client's runtime database. Mobile and desktop translate between private storage and this versioned schema, allowing their implementations and migrations to evolve independently; neither client maintains an adapter for the unused unversioned mobile prototype.
