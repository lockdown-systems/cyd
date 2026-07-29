# Ship version 2 archives without encryption

Version 2 Cyd archives remain plaintext ZIP packages, matching legacy version 1's security posture while the initial cross-platform contract is established. Passphrase encryption is deferred to a later format version; clients must not imply that v1 or v2 archives protect sensitive saved data such as chats, and exports should communicate that limitation clearly.
