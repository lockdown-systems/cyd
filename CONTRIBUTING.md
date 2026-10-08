# Contributing to Cyd

Cyd is a desktop app for Windows, Mac, and Linux, built with Electron, Vue, and TypeScript.

## Prerequisites

Install [Node.js LTS](https://nodejs.org/en) (24.x) and npm 12 or later.

Cyd depends on `better-sqlite3`, a native C++ addon. There is no prebuilt binary for every Node and Electron ABI combination, so we compile it from source with [node-gyp](https://github.com/nodejs/node-gyp). You'll need Python and a C/C++ toolchain. The specifics depend on your platform.

### Windows

Install both of these before running `npm install`:

- **Python 3.x**, from [python.org](https://www.python.org/downloads/windows/) or `winget install Python.Python.3.14`. Check "Add python.exe to PATH" in the installer.
- **[Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)** with the **Desktop development with C++** workload, or a full Visual Studio install with the same workload. This provides MSBuild and the MSVC compiler.

### macOS

Install the Xcode Command Line Tools, which provide both clang and python3:

```sh
xcode-select --install
```

### Linux

On Debian and Ubuntu:

```sh
sudo apt-get install -y build-essential python3
```

## Getting started

Install dependencies:

```sh
npm install
```

Configure your Cyd environment to use "open" mode. This disables the server, which allows outside contributors to build features:

```sh
npm run config-open
```

Run Cyd:

```sh
npm start
```

To make devtools open automatically, and to give each embedded webview its own devtools window, set `CYD_DEV` to `1`:

```sh
CYD_DEV=1 npm start
```

In PowerShell, set it as a separate statement:

```powershell
$env:CYD_DEV = "1"; npm start
```

## Running the tests

```sh
npm test
```

The `test` script wraps vitest in `bash -c` so it can take an optional path argument. On Windows, either run `npm test` from Git Bash, or use the script that skips the wrapper:

```sh
npm run test:windows
```

## Linting and formatting

```sh
# Check formatting, lint, and type-check
npm run lint

# Auto-fix lint errors
npm run fix

# Reformat with prettier
npm run format
```

## Other server modes

If you're an outside contributor you'll want "open" mode, as described above.

If you're part of Lockdown Systems and you need to test functionality that uses the server, you need "local", "dev", or "prod" mode:

```sh
# local mode: use a locally-hosted server at localhost:5000
npm run config-local

# dev mode: use the dev server at dev-api.cyd.social
npm run config-dev

# prod mode: use the prod server at prod-api.cyd.social
npm run config-prod
```

## Rebuilding native modules

If you switch Node or Electron versions, or see an error about a module being compiled against a different version of Node.js, rebuild the native modules:

```sh
npm run rebuild
```

If that isn't enough, discard the existing build first:

```sh
npm run rebuild-clean
```
