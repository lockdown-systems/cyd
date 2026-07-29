# Use AT Protocol APIs directly

Desktop Bluesky saving and deletion use authenticated AT Protocol APIs, matching Cyd Mobile's integration model. Browser or OAuth-window interaction is limited to authorization; Bluesky webview scraping, request interception, and MITM automation are outside the implementation boundary because they add X-specific fragility where supported APIs exist.
