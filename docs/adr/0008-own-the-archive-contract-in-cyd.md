# Own the shared archive contract in cyd

The normative Cyd Bluesky archive specification, Bluesky format-version history, and canonical compatibility fixtures live in the `cyd` repository. Other social platforms have independent archive contracts and version histories. Mobile and desktop may maintain implementation-specific types, but both must validate against this shared Bluesky contract so compatibility is not inferred from either application's current runtime schema.
