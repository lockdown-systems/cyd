# Credential storage

Cyd must not persist account-control credentials in application-managed
plaintext storage. This document describes what Cyd treats as a credential,
where each credential lives, what the storage does and does not protect
against, and how to verify the behavior by hand on each platform.

Related decisions: [ADR 0005](../adr/0005-exclude-credentials-from-archives.md),
[ADR 0018](../adr/0018-use-oauth-and-os-protected-credential-storage.md), and
[ADR 0030](../adr/0030-encrypt-credentials-not-saved-content.md).

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
`<settings>/credentials/account-{id}.json`. Each value in the vault is
ciphertext produced by `safeStorage`; the vault never contains a plaintext
credential. It lives outside every account database, media directory, and
archive, so exporting or copying account data cannot carry a credential along.

Nothing else may hold a credential. `setConfig` throws if asked to write one of
the legacy credential keys into the plaintext `config` table.

## Platform behavior

Cyd claims exactly the protection the selected backend provides, and no more.

| Platform                                | Backend                                            | Protected at rest                  | Disclosed to the user |
| --------------------------------------- | -------------------------------------------------- | ---------------------------------- | --------------------- |
| macOS                                   | Keychain                                           | Yes                                | No                    |
| Windows                                 | OS-backed protection (DPAPI)                       | Yes                                | No                    |
| Linux, GNOME and most desktops          | libsecret                                          | Yes                                | No                    |
| Linux, KDE                              | KWallet (any of `kwallet`, `kwallet5`, `kwallet6`) | Yes                                | No                    |
| Linux, no keyring                       | Chromium `basic_text`                              | **No**                             | Yes, in-app warning   |
| Linux, unrecognized password store      | reported as `unknown`                              | Unverified, treated as unprotected | Yes, in-app warning   |
| Any platform, `safeStorage` unavailable | none                                               | Nothing is persisted               | Yes, in-app warning   |

`basic_text` is Chromium's obfuscation-only fallback: it encrypts with a
hard-coded key, so anyone who can read the user's files can read the
credential. Cyd uses it deliberately rather than failing, because a Linux
desktop without a keyring is common and the alternative is an unusable app,
but it detects the case and says so in a dismissible warning bar that names
the backend. `logCredentialProtection()` records the same fact at startup.

When no backend exists at all, Cyd refuses to persist credentials:
`setCredential` throws `CredentialStorageUnavailableError` rather than writing
plaintext, and the OAuth flow fails with that message. The user can still use
Cyd; they reconnect each session.

## Threat model

Protected against:

- Another user on the same machine reading Cyd's files.
- Credentials leaking through Cyd's own exports: archives, error reports,
  diagnostics, and logs. SQL statement parameters are redacted to type and
  length before they reach any log or error report, so a credential cannot
  ride along in a debug line or a support bundle.
- Credentials outliving the account. Deleting an account deletes its whole
  credential namespace, and disconnecting a Bluesky migration revokes the
  session and deletes its OAuth state and session material.
- Casual inspection of a copied profile directory on macOS, Windows, and Linux
  with a keyring: the vault is unreadable without the OS-held key.

Not protected against:

- Malware or any code running as the user while the OS keyring is unlocked. It
  can ask the same facility for the same secrets. No application-level storage
  can prevent this.
- A compromised operating system, or an attacker with root or physical access
  to an unlocked machine.
- Linux with `basic_text`: a copied profile directory is readable by anyone.
  This is the case the warning bar exists for.
- Credentials already copied elsewhere by the user, including backups taken
  before this facility existed. See below.

## Migrating legacy plaintext credentials

Cyd previously serialized the X-to-Bluesky OAuth state and session, including
refresh tokens and a private DPoP key, into the account database's plaintext
`config` table. Opening an account database now sweeps those rows:

1. Each non-empty legacy value moves into the account's credential vault.
2. Every legacy row is deleted, including the blank tombstones the old code
   wrote in place of deleting.
3. The database's write-ahead log is checkpointed and the database vacuumed,
   so the deleted bytes do not survive in the WAL or in free pages.

If no credential backend is available, the sweep deletes the rows without
saving them: an unprotected credential is worse than no credential, and the
user reconnects.

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
      contains no readable token.
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
- [ ] The vault contains no readable token.

### Linux, KDE (KWallet)

- [ ] With KWallet running, start Cyd with `--password-store=kwallet6` (or the
      version the desktop provides). The app logs `backend: kwallet`, and no
      warning bar appears.
- [ ] KWallet Manager shows a Cyd entry.

### Linux, `basic_text` fallback

- [ ] Start Cyd with `--password-store=basic` on a machine with no keyring.
- [ ] The warning bar appears, names `basic_text`, and can be dismissed.
- [ ] The startup log contains the `NOT protected at rest` warning.
- [ ] Connecting still works, and the migration still runs.
- [ ] Restarting Cyd shows the warning again.

### Any platform, no backend

- [ ] Force `safeStorage.isEncryptionAvailable()` to be false (for example by
      running Linux with no keyring and `--password-store=gnome-libsecret`).
- [ ] The warning bar says Cyd will not save the connection.
- [ ] Connecting reports the credential-storage error instead of silently
      writing plaintext, and no vault file is created.

### Upgrade path

- [ ] Start from a Cyd profile connected on an older build, so the account
      database holds `blueskySessionStore-*` rows.
- [ ] Upgrade and open the account. The rows are gone, the vault holds the
      session, and the migration still works without reconnecting.
- [ ] `grep` the database, its `-wal`, and its `-shm` for the old token: no
      match.
