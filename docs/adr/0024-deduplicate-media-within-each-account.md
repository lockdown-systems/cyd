# Deduplicate media within each local account

Desktop stores media content-addressably within each UUID-keyed local account, and saved records reference those assets rather than owning duplicate files. Version 2 archives likewise package each unique asset once and map record references through the interchange database; cross-account deduplication is deferred so deleting or exporting one account does not depend on another account's storage.
