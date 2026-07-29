# Canonical archive interchange database

The `data.db` inside version 2 and later Cyd archives is a canonical interchange database rather than a copy of either client's runtime database. Mobile and desktop translate between private storage and this versioned schema, allowing their implementations and migrations to evolve independently; neither client maintains an adapter for the unused unversioned mobile prototype.
