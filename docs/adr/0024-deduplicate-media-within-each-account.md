# Deduplicate media within each Bluesky local account

Desktop stores media content-addressably within each UUID-keyed Bluesky local account, and Bluesky saved records reference those assets rather than owning duplicate files. Bluesky version 2 archives likewise package each unique asset once and map record references through the Bluesky interchange database; cross-account deduplication is deferred so deleting or exporting one Bluesky local account does not depend on another Bluesky local account's storage.
