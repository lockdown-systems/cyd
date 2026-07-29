# Stream and defensively validate archive imports

Archive import streams into an isolated staging root and rejects path traversal, symlinks, unexpected file types, forged manifest entries, and unsafe entry counts or metadata. It verifies declared sizes and digests while writing and monitors total expansion against available storage; large legitimate video archives have no small absolute size cap, but crossing conservative resource thresholds requires explicit confirmation.
