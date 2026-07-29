# Replace the unused desktop Bluesky model

The dormant desktop `blueskyAccount` model is unused and is not a compatibility surface, so the new Bluesky implementation starts from a clean domain and persistence model rather than preserving its settings shape. A forward migration removes obsolete tables, links, and unreachable rows while retaining historical migration history; no adapter is required for the abandoned desktop model.
