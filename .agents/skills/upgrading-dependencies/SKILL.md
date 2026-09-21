---
name: upgrading-dependencies
description: Upgrade Cyd's npm dependencies without breaking the Electron build. Use when updating dependencies, reducing the npm audit count, or taking an Electron, better-sqlite3 or Forge major.
---

# Upgrading dependencies

Three things in this repo punish a careless upgrade. npm refuses install scripts it has not been told to trust, by exact version. The test suite runs *inside* the Electron binary one of those scripts fetches, so a blocked script fails every test at once rather than in one spot. And most of the advisory count sits in transitive packages that no direct bump reaches.

Work in phases, cheapest and most load-bearing first. Every phase ends on **gates green**.

## The metric

`npm audit --json`, field `.metadata.vulnerabilities`. Record it before touching anything, and after every phase.

The count `npm install` prints at the end is a *different number*: it counts only what is installed on this machine, so the macOS-only `appdmg` chain is invisible on Linux. Comparing an install summary against an audit invents regressions that never happened. Diff audit against audit, and report which advisories resolved rather than the total alone.

`npm outdated` is a lead, not a source of truth. It reported a stale `Latest` for `typescript-eslint`, and better-sqlite3 publishes GitHub tags that never reach npm. Confirm every target with `npm view <pkg> version` before you install it.

## The gates

Run all of these after every phase. The suite takes seconds, so per-phase gating costs nothing and is what makes a failure name its own culprit.

```bash
npm test                              # runs inside the Electron binary
npm run lint                          # prettier + eslint + vue-tsc
npm run build --workspace=x-archive   # the static site shipped inside the app
```

Plus the native smoke test, which is the fastest ABI check there is:

```bash
ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron -e \
  "const D=require('better-sqlite3');new D(':memory:').exec('create table t(a)');console.log('NATIVE OK')"
```

Construct a `Database`. A bare `require('better-sqlite3')` returns cleanly with no compiled binary anywhere on disk, because the addon loads lazily — it is a false pass.

`npm run make-local` is the real packaging gate but needs an interactive `sudo` to chown `chrome-sandbox`. Ask the user to run it. `npx electron-forge package` covers most of the same ground without sudo.

## Phase 0 — baseline

Record the metric, and get all four gates green *before* changing anything. An upgrade onto a red baseline cannot be read.

Check that your npm matches the one in `Dockerfile`. A mismatch churns the lockfile on its own: npm 12 records a `libc` field on optional platform packages that npm 10 does not understand and silently strips, so the two versions fight over the same file across dev and the release build.

Note `workspaces` in `package.json`: `archive-static-sites/x-archive` shares the root lockfile, so its dependencies are your problem too. `scripts/x-capture` is not a workspace and is not part of the build.

## Phase 1 — the native floor

Electron and better-sqlite3, in that order, then reinstall.

Both run install scripts, and `package.json` holds an `allowScripts` map keyed by exact `name@version`. Bumping either silently invalidates its entry: Electron's binary never downloads and `dist/` disappears, better-sqlite3 never compiles. For each package whose version you moved:

```bash
npm install-scripts approve <pkg>   # rewrites allowScripts, prunes the stale pin
npm rebuild <pkg>                   # plain `npm install` will NOT re-run a newly approved script
```

`npm install-scripts ls` shows what is currently blocked. Check it after every install in every phase — `esbuild` and `core-js` go stale on their own as transitives move.

Then run the native smoke test before anything else.

## Phase 2 — Electron tooling

`@electron/*` helpers: `osx-sign`, `rebuild`, `fuses`.

Check `@electron-forge/*` but expect nothing: it is usually already at its latest published version, and its advisories are not fixable by upgrading. They are Phase 5's problem.

## Phase 3 — ecosystem clusters

Move each cluster as a unit, gates after each, so a failure names its own culprit:

- vitest + `@vitest/coverage-v8`
- vite + `@vitejs/plugin-vue` + `@intlify/unplugin-vue-i18n`
- eslint + `@typescript-eslint/*` + `typescript-eslint` + `eslint-plugin-vue` + `@vue/eslint-config-typescript` + globals
- vue + vue-i18n + vue-tsc + `@vue/test-utils` + vue-chartjs
- `@atproto/*`
- independent leaves

When npm deadlocks with `ERESOLVE` on a cluster, it is resolving incrementally against versions the lockfile already pins. Editing `package.json` and reinstalling does not break the deadlock. `npm uninstall` the whole cluster and install it back at explicit versions in one command.

A Prettier bump reformats source files. Run `npm run format` and read the diff.

Treat `ERESOLVE overriding peer dependency` as a warning to re-check at the *end* of the cluster, not mid-way. One resolved itself once the rest of the cluster caught up.

## Phase 4 — npm audit fix

```bash
npm audit fix --allow-git=all
```

This is worth more than every direct upgrade combined — it moves transitive pins, which is where the advisories live. It touches only the lockfile; confirm `package.json` is unchanged afterward.

`--allow-git=all` is required because Forge pulls `@electron/node-gyp` from a git URL and npm now refuses git fetches by default. Check afterward that no *new* git dependency entered the lockfile.

Never `--force`. npm's idea of a fix is whatever version lacks the advisory, including backwards: it offers to take `@electron-forge/cli` from 7.11.2 down to 7.6.1. Prefer an override.

## Phase 5 — overrides

For what is left, read the leaf advisories — the entries whose `via` holds objects rather than strings. Those are real CVEs; everything else is propagation.

`"fixAvailable": false` means npm cannot get there by bumping a direct dependency. It does **not** mean no patched release exists. Compare the advisory's vulnerable `range` against `npm view <pkg> version`: if the registry is ahead of the range, an `overrides` entry reaches it where npm would not.

Two shapes:

```jsonc
"overrides": {
  "tar": "^7.5.22",                    // force a version everywhere
  "mhtml2html": { "jsdom": "^29.1.1" } // force it only inside one parent
}
```

An override only re-resolves a subtree npm has not already pinned. If the old version survives the install, `npm uninstall` the parent and install it back.

Verify each override by exercising the dependent, not by reading the audit. Check how the parent actually uses the package first: `http-mitm-proxy` imports only uuid's named `v4`, which survived the major, and `archive.ts` passes its own `parseDOM` into mhtml2html, which is why that bundled jsdom could be replaced wholesale.

Leave alone what has no fixed version at any release, and say so plainly in the report.

## Phase 6 — reconcile allowScripts

Approving as you go leaves the map full of versions that are no longer installed. Reconcile it once at the end, because a stale entry is invisible until the next person's install blocks.

List what the tree actually asks for, and match the map to it:

```bash
node -e "const l=require('./package-lock.json');for(const[k,v]of Object.entries(l.packages||{}))if(v.hasInstallScript)console.log(k.replace('node_modules/','')+'@'+v.version)"
npm install-scripts approve <pkg>   # re-approving prunes that package's stale pin
```

That listing undercounts: npm also runs an implicit `node-gyp rebuild` for any package shipping a `binding.gyp`, even when it declares no install script and the lockfile sets no `hasInstallScript`. better-sqlite3 is one, which is why it still needs an entry despite shipping prebuilds — the entry only matters on a platform with no prebuild, where the source build is the fallback.

Delete by hand any entry whose package no longer runs a script at all. Electron from v42 is one: it downloads on first run instead.

Finish with a plain `npm install`, and confirm `npm install-scripts ls` reports nothing blocked.

## Majors

Minor-only is the default. When the minor pass is green, report the remaining advisories and **ask the user** whether to take majors — name the specific ones, what each is worth, and what it costs.

Read [`references/majors.md`](references/majors.md) before taking any.
