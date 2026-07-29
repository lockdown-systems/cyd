# Bidirectional Cyd archive compatibility begins with version 2

Cyd mobile and desktop exchange Cyd archives beginning with the canonical version 2 format. The unversioned mobile prototype has no users and is unsupported by both clients; abandoning it avoids coupling the shared contract to Mobile's historical runtime schema. Each client clearly rejects archive versions it does not support so evolving one application does not silently break portability with the other.
