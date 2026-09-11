# Cyd credential store

Cyd must not persist account-control credentials in an account's database, its
media directory, or anything Cyd exports. This document describes what Cyd
treats as a credential, where each credential lives, what the store does and
does not protect against, and how to verify the behavior by hand on each
platform.

Related decisions: [ADR 0005](../adr/0005-exclude-credentials-from-archives.md),
[ADR 0018](../adr/0018-use-oauth-and-os-protected-credential-storage.md),
[ADR 0030](../adr/0030-encrypt-credentials-not-saved-content.md), and
[ADR 0033](../adr/0033-persist-credentials-with-disclosure.md).

## What counts as a credential

Anything that lets its holder act on the user's account:

- OAuth access and refresh tokens
- Private DPoP keys
- Authorization state that contains a secret, such as a PKCE verifier
- App passwords and other reusable session material
- Authentication cookies

A Bluesky DID, an X username, and account settings are identifiers and
preferences, not credentials. They stay in Cyd's ordinary storage.

## Where credentials live

| Credential                           | Store                                              | Protected by                                                 |
| ------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------ |
| X login cookies                      | Electron/Chromium `persist:account-{id}` partition | The platform password backend Chromium selects               |
| X-to-Bluesky OAuth session and state | Cyd credential store (`src/credentials`)           | Electron `safeStorage`, which uses the same platform backend |

The Cyd credential store keeps one vault file per account under
`<settings>/credentials/account-{id}.json`, owner-only where the platform has
POSIX permissions. It lives outside every account database, media directory,
and archive, so exporting or copying account data cannot carry a credential
along. What "owner-only" means on Windows is narrower than on macOS and Linux;
see the threat model below.

Each value in the vault records whether it is protected:

```json
{ "version": 2, "credentials": { "name": { "protected": true, "value": "…" } } }
```

`"protected": true` means the value is ciphertext produced by `safeStorage`.
`"protected": false` means the operating system offered nothing to encrypt it
with and the value is the credential itself, in the clear. Cyd persists it
either way and discloses the second case; see below. The flag is per value, so
a user who installs a keyring gets protected storage for everything written
afterwards, and the credentials already on disk stay readable.

Callers reach the vault through `accountCredentials(accountID)` and name a
credential; which vault it belongs to and how it is protected are the store's
business, not theirs.

Nothing else may hold a credential. `setConfig` throws if asked to write one of
the credential keys into the plaintext `config` table.

## Platform behavior

Cyd claims exactly the protection the selected backend provides, and no more.
It always persists.

| Platform                                | Backend                                            | Protected at rest | Disclosed to the user |
| --------------------------------------- | -------------------------------------------------- | ----------------- | --------------------- |
| macOS                                   | Keychain                                           | Yes               | No                    |
| Windows                                 | OS-backed protection (DPAPI)                       | Yes               | No                    |
| Linux, GNOME and most desktops          | libsecret                                          | Yes               | No                    |
| Linux, KDE                              | KWallet (any of `kwallet`, `kwallet5`, `kwallet6`) | Yes               | No                    |
| Linux, no keyring                       | Chromium reports `basic_text`                      | **No**            | Yes, in-app warning   |
| Linux, unrecognized password store      | reported as `unknown`                              | **No**            | Yes, in-app warning   |
| Any platform, `safeStorage` unavailable | reported as `unavailable`                          | **No**            | Yes, in-app warning   |

Only libsecret, KWallet, the macOS Keychain, and Windows DPAPI count as
protection, and only when `safeStorage.isEncryptionAvailable()` agrees. A
password store Cyd does not recognize is reported as `unknown` and treated as
no protection at all, because Cyd cannot describe what it protects against and
must not imply otherwise.

Two Electron behaviors are worth knowing when reading this code:

- `safeStorage.isEncryptionAvailable()` returns **false** whenever Chromium
  fell back to the `basic_text` password store, unless the app calls
  `setUsePlainTextEncryption(true)`. Cyd does not call it, so the keyring-less
  Linux case arrives here as "encryption unavailable" rather than as a working
  `basic_text` backend. Cyd stores those credentials itself, in the clear,
  rather than through Chromium's hard-coded-key obfuscation, which would be
  the same exposure with a misleading name.
- A backend name is not a promise. Chromium can name `gnome_libsecret` while
  nothing answers on the bus, so `osProtected` requires both the name and
  working encryption.

A third is specific to Windows, and shapes how that platform must be tested.
`safeStorage` there is not a separate OS vault the way the macOS Keychain is.
Chromium encrypts with a random AES-256-GCM key of its own, hands Cyd the
ciphertext to store wherever it likes — a `v10`-prefixed blob in the vault —
and keeps that key in the profile's `Local State` file, under
`os_crypt.encrypted_key`, wrapped with DPAPI. Both halves therefore sit inside
the profile directory as ordinary files, and DPAPI's per-user key is the only
thing standing between another account on the machine and a copied profile.
That is why the Windows check below copies `Local State` along with the vault:
a vault copied on its own fails to decrypt merely because the receiving
profile minted a different AES key, which would happen even if DPAPI were
doing nothing at all.

Where nothing protects credentials, Cyd says so rather than failing: the
warning bar names the password store, and `logCredentialProtection()` records
the same fact at startup. The user stays connected. X login cookies are a
separate matter and were never protected by this facility: Chromium keeps
persisting them through whatever password store it selected, which is why the
warning names cookies too rather than claiming only Bluesky is affected.

The warning bar can be dismissed for the session, matching how Cyd's other
persistent bars behave. The limitation does not change until the user installs
a keyring, and the bar reappears on the next launch; the startup log records it
either way.

## Threat model

Protected against, on every platform:

- Credentials leaking through Cyd's own exports: archives, error reports,
  diagnostics, and logs. SQL statement parameters are redacted to type and
  length before they reach any log or error report, so a credential cannot
  ride along in a debug line or a support bundle. The vault sits outside
  everything Cyd exports.
- Another account on the same machine reading Cyd's files. On macOS and Linux
  the vault directory is `0700` and each vault file `0600`. Windows has no
  POSIX mode bits, and Cyd sets no explicit ACL there, so the vault inherits
  the permissions of whatever directory holds it. At the default location
  under `%APPDATA%` that inheritance is owner-only — the user, `SYSTEM`, and
  `Administrators`, measured with `icacls` — but a profile placed somewhere
  permissive with `--user-data-dir`, such as under `C:\temp`, inherits
  `BUILTIN\Users:(RX)` and `NT AUTHORITY\Authenticated Users:(M)` and is then
  readable, and writable, by every local account. On Windows it is DPAPI, not
  the file permissions, that stops another user from using a credential they
  can read.
- Credentials outliving the account. Cyd revokes before it discards:
  disconnecting a Bluesky migration and deleting an account both ask the
  authorization server to invalidate the session first, then delete the
  account's whole vault and clear Chromium's partition for its cookies. A
  revocation that fails, because the machine is offline, never blocks the
  deletion the user asked for.

  Revocation kills the grant, not every token already minted from it.
  Verified against `bsky.social`: after a disconnect the refresh token is
  rejected immediately with `Invalid refresh token`, so a copied session
  cannot be renewed. An access token issued before the disconnect keeps
  working until it expires, an hour at most on Bluesky, because an
  authorization server cannot retract one it has already signed. That window
  is the limit of what revocation can offer anywhere, not a Cyd behavior.

  On Bluesky-hosted accounts a second delay compounds it. Those reach an
  "entryway" service acting as the authorization server, and revoking there
  can take up to fifteen minutes to propagate: refresh tokens stop working at
  once, access tokens do not. A free-standing PDS revokes both immediately.
  Worth knowing before hand-testing a disconnect, because the lag looks like
  a failed revocation.

  A revocation that fails is not detectable locally. The AT Protocol client
  discards the outcome of the revocation request, so Cyd cannot log it,
  retry it, or tell the user. A disconnect looks identical whether the
  server honored it or never received it; only the token itself can say.

Protected against only where the operating system offers a keyring:

- Casual inspection of a copied profile directory. On macOS, Windows, and
  Linux with libsecret or KWallet, the vault is unreadable without the
  OS-held key. **Without a keyring it is readable by anyone who can read the
  file**, which is what the warning bar exists to say.

Not protected against, anywhere:

- Malware or any code running as the user while the OS keyring is unlocked. It
  can ask the same facility for the same secrets. No application-level storage
  can prevent this.
- A compromised operating system, or an attacker with root or physical access
  to an unlocked machine.
- Credentials already copied elsewhere by the user, including backups taken
  before this facility existed. See below.

## Migrating legacy plaintext credentials

Cyd previously serialized the X-to-Bluesky OAuth state and session, including
refresh tokens and a private DPoP key, into the account database's plaintext
`config` table. Opening an account database now sweeps those rows:

1. Each non-empty legacy value moves into the account's credential vault,
   protected if the operating system can protect it and in the clear if not.
2. Every legacy row is deleted, including the blank tombstones the old code
   wrote in place of deleting.
3. The database's write-ahead log is checkpointed and the database vacuumed,
   so the deleted bytes do not survive in the WAL or in free pages.

The sweep moves the credential even on a desktop with no keyring, because the
vault is owner-only and outside the archives, exports, and error reports the
config table was not. It is a real improvement there, just not encryption, and
the user keeps the connection they already had.

The sweep migrates rather than revokes, so a user stays connected. It cannot
reach copies that already left the machine: a backup, a synced folder, or a
support bundle created before this change may still contain the old tokens. A
user who is worried about that should disconnect the Bluesky migration, which
revokes the session at the authorization server, and reconnect.

## Manual verification checklist

Run through this on each platform before releasing changes to credential
storage. "Connect" means completing the X-to-Bluesky migration OAuth flow.

### macOS (Keychain)

Checked against the real `safeStorage` on macOS 26.6 (Darwin 25.6.0), not
against the test double. This platform is the one where `osProtected` is
inferred rather than corroborated: Chromium names no password store off Linux,
so `rawBackend` is `null` and the only cross-check available is the Keychain
item itself. Confirm that item exists rather than trusting the flag.

Two paths differ from the other platforms and will silently produce a false
pass if taken from the Linux instructions:

- **The log is not under userData.** `electron-log` writes to
  `~/Library/Logs/{appName}/main.log` on macOS whatever `--user-data-dir`
  says, so `<userData>/logs/main.log` does not exist. That file is also shared
  across profiles, so filter by timestamp rather than using `tail -1`.
- The account database is under `dataPath`, which `--user-data-dir` does
  **not** redirect. A throwaway profile still reads and writes the real
  `~/Documents/Cyd Dev`. Back that directory up before seeding a canary.

- [x] Connect. `Keychain Access` shows a `Cyd Safe Storage` entry — named
      `Cyd Dev Safe Storage`, account `Cyd Dev Key`, on a dev build — and the
      app logs
      `{"platform":"darwin","backend":"macos_keychain","rawBackend":null,"osProtected":true}`.
      Check the item's creation date against the timestamp of that log line:
      matching to the second is what shows this launch minted the key, rather
      than an earlier install having left one behind.
- [x] No warning bar appears, and no `NOT protected at rest` line is logged.
- [x] `<settings>/credentials/account-{id}.json` exists, is mode `600` inside
      a `700` directory, and every entry is `"protected": true` with no
      readable token.
- [x] The stored value is a `v10` AES-256-GCM blob, the same envelope Windows
      produces; on macOS the key wrapping it is the Keychain item above rather
      than a DPAPI-wrapped key in `Local State`. Base64-decoding an entry must
      yield opaque bytes. Readable JSON here would mean `"protected": true` is
      lying, which is this platform's characteristic failure.
- [x] `grep` the account's `data.sqlite3` for `refresh_token` and `dpopJwk`:
      no match, and `config` holds `blueskyDID` and nothing else. Grepping the
      whole of `dataPath` and the profile, rather than the three named files,
      found no token plaintext anywhere.
- [x] The legacy sweep migrates on this platform too: the canary moves into
      the vault encrypted rather than merely relocated, the blank tombstone
      row goes as well, and the canary is gone from `.sqlite3`, `-wal`, and
      `-shm`.
- [x] Disconnect. The vault entries are gone — and so is the vault file,
      because `writeVault` removes a vault that has gone empty rather than
      leaving a file that would suggest credentials still exist.
- [ ] Disconnect revokes server-side. Not re-verified here. `disconnect()`
      lives in `BlueskyService` with no `darwin` branch, and the refresh token
      was confirmed rejected on Windows, so this is platform-independent
      rather than untested. Note that grepping the log for `revok` proves
      nothing: there is no success line, and the only local signal is the
      _absence_ of `BlueskyService.disconnect: Error revoking session`, which
      rules out a network failure and not a refusal.
- [x] Delete the account. `<settings>/credentials/account-{id}.json` is gone.
      `deleteAccount` calls `deleteAll()` unconditionally, after the
      per-type branch, so this holds for an account that never connected.

### Windows (OS-backed protection)

Checked against the real `safeStorage` on Windows 11 26200 with Electron
41.7.1, not against the test double.

- [x] The app logs
      `{"platform":"win32","backend":"windows_dpapi","rawBackend":null,"osProtected":true}`.
      `rawBackend` is `null` by design: `getSelectedStorageBackend()` is
      `undefined` off Linux.
- [x] The vault is version 2 and every entry is `"protected": true`. The
      stored value is a `v10` AES-256-GCM blob: it holds no readable fragment
      of the credential, its length differs from the plaintext, and encrypting
      the same value twice yields different ciphertext.
- [x] A credential written by one launch is readable by the next. The
      `Local State` file is written during shutdown, so a profile that never
      quits cleanly loses the AES key, and with it every entry in the vault.
- [x] An entry that cannot be decrypted is logged, dropped, and leaves the
      rest of the vault intact.
- [x] The legacy sweep migrates on this platform too, and the canary is gone
      from `.sqlite3`, `-wal`, and `-shm` afterwards.
- [x] Record `icacls` for the vault and its directory. Owner-only under the
      default `%APPDATA%` profile; see the threat model for what a permissive
      `--user-data-dir` inherits instead.
- [x] Copy **both** the vault and `<userData>\Local State` to another Windows
      user account, and confirm Cyd there cannot decrypt. Copying the vault
      alone does not test this: it fails because the receiving profile minted
      a different AES key, whether or not DPAPI held. Confirmed against a
      second local account: both files were readable, and DPAPI still refused
      the wrapped key with "Key not valid for use in specified state". A
      readable file and an unusable credential is the guarantee this platform
      actually offers.
- [x] Connect through the app. The vault appears, holds only the session
      entry once the callback completes, and the account database's `config`
      table holds `blueskyDID` and nothing else. No warning bar appears.
- [x] Disconnect. The vault file is removed, and the session is revoked at
      the authorization server rather than only forgotten locally: the
      refresh token is rejected with `Invalid refresh token` on the next
      attempt. Do not test this with the access token, which stays valid
      until it expires; back-date the saved token set's expiry so the client
      is forced to use the refresh token, and watch for `POST /oauth/token`.
- [ ] Delete the account, and confirm the vault file is gone. Revocation here
      is the same code path rather than a second implementation:
      `revokeAccountConnections` calls `revokeXBlueskyConnection`, which calls
      `blueskyDisconnect()` and so reaches the `disconnect()` verified above.
      It returns early when the account has no stored `blueskyDID`.

### Linux, GNOME (libsecret)

- [ ] With `gnome-keyring` running, connect. The app logs
      `backend: gnome_libsecret`, and no warning bar appears.
- [ ] `secret-tool search --all application chromium` (or Seahorse) shows a
      Cyd entry.
- [ ] The vault contains no readable token, and every entry is
      `"protected": true`.

### Linux, KDE (KWallet)

- [ ] With KWallet running, start Cyd with `--password-store=kwallet6` (or the
      version the desktop provides). The app logs `backend: kwallet`, and no
      warning bar appears.
- [ ] KWallet Manager shows a Cyd entry.

### Linux, no keyring

- [ ] Start Cyd with `--password-store=basic`, or on a machine with no keyring
      running at all.
- [ ] The app logs `backend: basic_text` and the `NOT protected at rest`
      warning.
- [ ] The warning bar appears, names the password store, says the credentials
      are stored without operating-system protection, and can be dismissed.
- [ ] The warning does not claim Cyd stores nothing.
- [ ] Connecting still works, and the migration still runs.
- [ ] The vault entries are `"protected": false` and the token is readable in
      the file. This is the disclosed behavior, not a bug.
- [ ] Restarting Cyd shows the warning again.

### Linux, unrecognized password store

- [ ] Make Chromium report a password store Cyd does not know.
- [ ] The warning bar appears, names the store, and says Cyd does not
      recognize it, without claiming the desktop has no keyring.
- [ ] Connecting still works, and the credential is stored unprotected.

### Any platform, no backend

- [ ] Force `safeStorage.isEncryptionAvailable()` to be false.
- [ ] The warning bar says the credentials are not protected, and names the
      backend as `unavailable`.
- [ ] Connecting still works, and no plaintext credential is written to the
      account database.

### Upgrade path

- [ ] Start from a Cyd profile connected on an older build, so the account
      database holds `blueskySessionStore-*` rows.
- [ ] Upgrade and open the account. The rows are gone, the vault holds the
      session, and the migration still works without reconnecting.
- [ ] `grep` the database, its `-wal`, and its `-shm` for the old token: no
      match.
- [ ] Repeat on a machine with no keyring: the session still moves, the vault
      entry is `"protected": false`, and the account stays connected.
