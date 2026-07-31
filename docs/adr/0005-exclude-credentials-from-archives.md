# Exclude credentials from Cyd archives

Cyd Bluesky archives never contain OAuth tokens, private keys, session state, or other reusable credentials. Imported accounts are immediately available for offline browsing, but each installation must establish its own Bluesky connection before it can refresh data or perform account actions, preventing a portable archive from becoming an account-control credential.
