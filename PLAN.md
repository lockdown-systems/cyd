# Windows Release Split Plan (CI Build + Local Smart-Card Signing)

## Problem Summary

Current Windows production release (`npm run publish-prod`, same structure for dev) is doing all of this in one command on a Windows machine:

1. Build app artifacts.
2. Sign artifacts (HARICA cert on USB smart card + PIN entry).
3. Produce Squirrel outputs, including full package + delta package + `RELEASES`.
4. Upload artifacts to release storage.

Because signing requires a single physical smart card, x64 and arm64 have to be released sequentially across two separate Windows VMs, which makes releases slow and operationally expensive.

## Goal

Move all non-signing work into GitHub Actions and leave only the hardware-bound signing/upload steps for a local Windows script, following the same operational model as Linux releases.

## Design Principles

1. Keep the signing private key and PIN entry local only.
2. Build once in CI per architecture (x64 + arm64).
3. Make local release execution deterministic and scriptable.
4. Preserve current release URL layout and Squirrel update behavior.
5. Keep dev/prod flows symmetric.
6. Fully deprecate Windows `npm run publish-*` after cutover while keeping macOS publish flow intact.

## Target End State

### CI responsibilities

For each tag release (or manual dispatch), CI should:

1. Validate tag version matches `package.json`.
2. Build Windows x64 and Windows arm64 unsigned release inputs.
3. Upload per-arch artifacts to GitHub Actions artifacts.
4. Publish a machine-readable manifest describing:
   - version
   - env (`dev` or `prod`)
   - artifact names
   - expected checksums
   - commit SHA

### Local (smart card) responsibilities

A local script run on a Windows VM should:

1. Download CI artifacts + manifest for a chosen run/tag.
2. Verify checksums.
3. Run Squirrel packaging/signing flow with HARICA smart card and timestamp server.
4. Generate/update `RELEASES`, full package, and delta package.
5. Upload final signed outputs to release storage.
6. Verify uploaded artifacts are reachable at expected URLs.

## Proposed Implementation Plan

## Phase 1: Decouple Build from Publish in Repo Scripts

1. Add dedicated scripts that separate concerns:
   - `make-windows-unsigned` (build/package only; no signing, no upload)
   - `finalize-windows-release` (sign/package delta/upload)
2. Refactor current release orchestration so `publish-*` can eventually delegate to the new split flow.
3. Ensure this refactor does not change macOS/Linux paths.

Deliverable:
- New scripts under `scripts/` with clear environment contract (`CYD_ENV`, arch, run id/tag).

## Phase 2: Add Windows Build Workflow in GitHub Actions

1. Create `.github/workflows/windows-release.yml` similar in structure to Linux release workflow.
2. Trigger options:
   - tag push (`v*`) for production release flow
   - `workflow_dispatch` for dev/prod/manual retries
3. Jobs:
   - `build-windows-x64` on Windows x64 runner
   - `build-windows-arm64` on hosted Windows arm64 runner
4. Each job should:
   - checkout
   - validate version/tag
   - run unsigned build command
   - create checksums (SHA256)
   - upload artifacts with stable names

Suggested artifact naming pattern:
- `windows-unsigned-prod-x64`
- `windows-unsigned-prod-arm64`
- `windows-unsigned-dev-x64`
- `windows-unsigned-dev-arm64`

Deliverables:
- New workflow file
- Artifact manifest format definition (`windows-release-manifest.json`)

## Phase 3: Local Windows Finalization Script (Linux-Repo Style)

1. Add a PowerShell script in `cyd/scripts`, e.g.:
   - `scripts/release-windows-prod.ps1`
   - `scripts/release-windows-dev.ps1`
2. Script behavior:
   - pull latest successful run for workflow + env (or accept explicit run id)
   - download artifacts via `gh run download`
   - verify checksum manifest
   - invoke finalization command for both arches in one run
   - prompt for smart card PIN only during signing operations
   - use existing remote release channel as source of previous packages for delta generation
   - emit signed setup `.exe`, signed full `.nupkg`, signed delta `.nupkg` (when applicable), and `RELEASES`
   - upload signed outputs to storage
3. Make script idempotent where possible (safe retries if upload partially succeeded).

Deliverables:
- Local release scripts with usage docs
- Shared helper script/module for: run selection, download, checksum verify, upload

Acceptance check:
- Auto-update client can upgrade from previous version using generated `RELEASES` and delta path.

## Operational Requirements

1. CI secrets:
   - only build-safe secrets (none for private signing key/PIN).
2. Local machine prerequisites doc:
   - `gh` auth
   - storage credentials
   - smart card middleware/tools
   - signtool availability check
3. Add preflight checks in scripts:
   - verify smart card token present
   - verify certificate subject matches expected org
   - verify timestamp server reachable

Deliverable:
- Windows release README section with preflight + rollback process

## Phase 4: Cutover and Validation

1. Dry-run on `dev` channel first:
   - one version end-to-end
   - both arches
2. Compare outputs vs current `publish-dev` flow:
   - filenames
   - signatures
   - `RELEASES` format
   - update behavior
3. After successful dev validation, switch prod process to new flow.
4. Deprecate Windows `npm run publish-dev` and `npm run publish-prod` and document the new CI + local finalization flow as the only Windows release path.
5. Keep macOS publish path unchanged for now.

## Concrete Work Items (Recommended Order)

1. Add windows-release workflow and artifact manifest.
2. Add unsigned build script entrypoint.
3. Add local finalization scripts (prod/dev).
4. Add upload + verification helpers.
5. Add docs (`README.md` section: Windows split release).
6. Run dev dry-run and fix parity gaps.
7. Promote to prod.

## Definition of Done

1. A release manager can produce both Windows arches using:
   - CI for builds
   - one local script invocation for both arches, with smart-card signing/finalization/upload
2. Local runtime is mostly signing/upload time (not full Electron build time).
3. No signing keys/PIN ever move into CI.
4. Squirrel `RELEASES` and delta updates work as before.
5. Process is documented and reproducible.

## Notes from Current Codebase

1. Existing release behavior is tightly coupled through `scripts/make.js` and `electron-forge publish`.
2. Windows signing and delta behavior are controlled in Forge via `MakerSquirrel` using:
   - `signWithParams`
   - `noDelta`
   - `remoteReleases`
3. Linux already follows the desired pattern (CI artifacts + local signing/repo update scripts), which is the operational template for this change.
