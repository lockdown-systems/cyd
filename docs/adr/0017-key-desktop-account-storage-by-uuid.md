# Key desktop Bluesky storage by local UUID

Each desktop Bluesky local account owns a private runtime database and media directory keyed by its Cyd UUID, with the Bluesky DID stored as the durable social identity and the mutable handle kept as account data. Handle changes therefore require no filesystem move, and each account remains an isolated unit for browsing and archive translation.
