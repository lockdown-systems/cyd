# Taking a major

Reached from [`../SKILL.md`](../SKILL.md) once the minor pass is green and the user has chosen which majors to take.

## Order

Take **better-sqlite3 before Electron**, always.

From v13 it is built on N-API and ships portable prebuilds, so one binary spans ABIs. Taking it first means the Electron jump needs no rebuild at all — verified across ABI 145 to 149. Taking Electron first means fighting a rebuild you did not need to have.

The same logic generalises: move whatever is pinned to the runtime's ABI before moving the runtime.

## Read the release notes for the whole span

Not just the target. List the releases with `gh api "repos/<owner>/<repo>/releases?per_page=100"` and read every major in between, because breaking changes land in the ones you skip over.

Harvest two things: an explicit **end-of-support** warning, which turns a nice-to-have into a security deadline, and any note about **build hosts** rather than APIs. Those are the ones that do not show up in a test run.

## Scan before you install

Grep the source for every API the notes call out, and settle each hit before touching the manifest. Most will be misses, and knowing that up front is what makes the upgrade cheap.

The hits that matter are the ones where the *call site* decides. An option removed from a method costs nothing if this repo never passes it; a name that survives only in a type union costs nothing either. Read the call, not the symbol.

## Electron

- **node-abi lags.** `@electron/rebuild` pins a `node-abi` that does not know the newest Electron, and `electron-rebuild` then fails outright with `Could not detect abi for version`. An `overrides` entry on `node-abi` fixes it. `postinstall` runs `electron-rebuild` and exits non-zero on failure, so this breaks plain `npm install`.
- **From v42 the binary downloads on first run**, not in `postinstall`. An absent `node_modules/electron/dist` straight after an install is now normal; invoke the binary once to populate it.
- **Arch and OS removals** are packaging concerns, not code. Check `forge.config.ts` makers and the workflows in `.github/workflows/` for whether a dropped target is actually built.

## better-sqlite3

Check the glibc floor of the shipped prebuild against the build image in `Dockerfile`, not against the machine you are working on:

```bash
objdump -T node_modules/better-sqlite3/prebuilds/linux-x64.node | grep -oE "GLIBC_[0-9.]+" | sort -Vu | tail -1
```

Release notes quote a floor for the *old* per-ABI assets that does not apply to the N-API prebuilds. Measure the binary.

## x-archive

An archive is read by double-clicking `index.html`, so everything it ships is constrained by `file://`:

- Browsers refuse to fetch **ES modules** over `file://`. The entry has to stay a classic script, and `vite.config.ts` rewrites Vite's module tag to keep it that way.
- `crossorigin` on a script or stylesheet forces CORS mode, which fails the same way.
- A classic script in `<head>` runs **before** `#app` is parsed, so it needs `defer` or it mounts onto nothing.

None of this is visible to `npm test`, and the build succeeds either way. Verify by loading the built `dist/index.html` over `file://` in Electron with a seeded `window.archiveData`, and assert on rendered output: the document title, some body text, a computed style, a loaded font.

## Blocked majors

Some majors are held by a peer range rather than by their own difficulty. `@typescript-eslint` peer-requires `typescript >=4.8.4 <6.1.0`, so TypeScript 7 waits on typescript-eslint, not on this repo. Check peer ranges before promising a major is available.

## Dead build tooling is a migration

When a tool's last release is its final one, its advisories have no upgrade path and npm will only ever offer a downgrade. Price it as a migration to a maintained tool and put it to the user as such, rather than carrying the advisories forward each pass.
