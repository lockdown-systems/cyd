# ADR 0002: Protect credentials only, with disclosure

Credentials for every platform — Bluesky OAuth sessions, X and Facebook
browser sessions, and anything else that authorizes account control — are
stored outside every account database, media directory, and archive through
the desktop-wide credential facility, which uses OS-protected storage
wherever one is available. Where none is, it stores the credential in the
clear in the same owner-only vault and tells the user so, rather than
refusing to persist it. Saved content relies on operating-system account
permissions and disk encryption; credentials are the exception because they
authorize account control. Bluesky connects through OAuth rather than app
passwords, and Cyd holds one Bluesky OAuth session per DID, shared by every
account acting on that identity, deriving its holders from account state so
a session is revoked at the PDS only when the last holder disconnects.
