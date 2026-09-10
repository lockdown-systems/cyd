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

The Cyd credential store keeps one owner-only vault file per account under
`<settings>/credentials/account-{id}.json`. It lives outside every account
database, media directory, and archive, so exporting or copying account data
cannot carry a credential along.

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
- Another account on the same machine reading Cyd's files: the vault directory
  is `0700` and each vault file `0600`.
- Credentials outliving the account. Cyd revokes before it discards:
  disconnecting a Bluesky migration and deleting an account both ask the
  authorization server to invalidate the session first, then delete the
  account's whole vault and clear Chromium's partition for its cookies. A
  revocation that fails, because the machine is offline, never blocks the
  deletion the user asked for.

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

- [ ] Connect. `Keychain Access` shows a `Cyd Safe Storage` (or equivalent)
      entry, and the app logs `backend: macos_keychain`.
- [ ] No warning bar appears.
- [ ] `<settings>/credentials/account-{id}.json` exists, is mode `600`, and
      every entry is `"protected": true` with no readable token.
- [ ] `grep` the account's `data.sqlite3` for `refresh_token` and `dpopJwk`:
      no match.
- [ ] Disconnect. The vault entries are gone.
- [ ] Delete the account. `<settings>/credentials/account-{id}.json` is gone.

### Windows (OS-backed protection)

- [ ] Connect. The app logs `backend: windows_dpapi`, and no warning bar
      appears.
- [ ] The vault file exists and contains no readable token.
- [ ] Copy the vault to another Windows user account and confirm Cyd there
      cannot decrypt it.
- [ ] Delete the account. The vault file is gone.

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
