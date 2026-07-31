# Export portable Bluesky saved data, not operational state

Bluesky version 2 archives include the Bluesky identity and captured profile, Bluesky saved records and media, Bluesky source-deletion state, asset-completeness state, and portable Bluesky account settings. They exclude credentials, schedules, pending or historical jobs, logs, analytics, error reports, temporary files, caches, and UI state because those are client-local operations whose transfer could duplicate work or trigger unintended behavior.
