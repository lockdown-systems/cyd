# Own the shared archive contract in cyd

The normative Cyd archive specification, format-version history, and canonical compatibility fixtures live in the `cyd` repository. Mobile and desktop may maintain implementation-specific types, but both must validate against this shared contract so compatibility is not inferred from either application's current runtime schema.
