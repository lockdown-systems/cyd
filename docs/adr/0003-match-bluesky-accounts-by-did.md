# Match Bluesky accounts by DID

Archive import matches a Bluesky account by DID, not by handle or Cyd UUID. Handles can change and separate installations can assign different UUIDs to the same Bluesky identity; UUIDs remain local-account identifiers and are preserved when possible, while DID matching prevents duplicate local accounts for one Bluesky identity. A matching DID keeps the existing local UUID; a new DID adopts the archive UUID when it is unused, or receives a newly generated UUID with a reported remapping when the archive UUID already belongs to another identity.
