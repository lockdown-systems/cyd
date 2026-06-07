# Windows Local Release Scripts

These scripts implement the local smart-card finalization flow for Windows releases.

## Prerequisites

1. Run from a Windows machine with the smart card connected.
2. Authenticate GitHub CLI:

```powershell
gh auth login
```

3. Ensure release upload credentials are present in environment variables used by Electron Forge (`DO_SPACES_KEY`, `DO_SPACES_SECRET`).
4. Ensure signing certificate is available through the smart card and `signtool` is working.

## Scripts

- `release-windows-dev.ps1`
- `release-windows-prod.ps1`

Both wrappers call `release-windows-common.ps1`, which:

1. Resolves a successful run id from the `Release for Windows` workflow (or uses a provided run id).
2. Downloads workflow artifacts.
3. Verifies file checksums against `windows-release-manifest.json`.
4. Runs local finalization for x64 and arm64 in one execution.
5. Verifies uploaded `RELEASES` files are reachable (unless skipped).

## Usage

Use latest successful run for dev:

```powershell
./scripts/release-windows-dev.ps1
```

Use latest successful run for prod:

```powershell
./scripts/release-windows-prod.ps1
```

Use a specific run id:

```powershell
./scripts/release-windows-dev.ps1 -RunId 1234567890
./scripts/release-windows-prod.ps1 -RunId 1234567890
```

Skip URL verification step:

```powershell
./scripts/release-windows-prod.ps1 -SkipUploadVerification
```
