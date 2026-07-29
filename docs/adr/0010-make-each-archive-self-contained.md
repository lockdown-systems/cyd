# Make each Cyd archive self-contained

Every Cyd archive is a complete snapshot of the local account's saved data and media at export time rather than an incremental delta that depends on earlier archives. Individual archives may be larger, but any one of them remains sufficient for recovery or cross-device transfer and can be merged idempotently on import.
