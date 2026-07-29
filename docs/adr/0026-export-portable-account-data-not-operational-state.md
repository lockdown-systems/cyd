# Export portable account data, not operational state

Version 2 archives include account identity and captured profile, saved records and media, source-deletion state, asset-completeness state, and portable save/delete rule defaults. They exclude credentials, schedules, pending or historical jobs, logs, analytics, error reports, temporary files, caches, and UI state because those are client-local operations whose transfer could duplicate work or trigger unintended behavior.
