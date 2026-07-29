# Bound contextual data preservation

A saved Bluesky record includes snapshots of the directly referenced data needed to render it faithfully, including its author, reply parent, quoted record, external embed, facets, and media. Cyd does not recursively crawl entire threads or social graphs; related records that are independently saved are linked through stable AT URIs, keeping backups complete for selected records without unbounded expansion.
