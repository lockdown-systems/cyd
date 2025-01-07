# Cyd

The environment variable `CYD_ENV` is used to determine the API URL. The options are:

- `dev`: the dev server at https://dev-api.cyd.social/v1/
- `prod` (default): the prod server at http://api.cyd.social/v1/

If you want devtools to open up, set `CYD_DEV=1`.

## Initializing resources

Cyd requires resources to be created before you run it.

When you create an archive of data from an account, it needs to unzip an archive static site. To do this, you need to build the static site first and zip it up. This happens automatically when creating a build.

There's also a `config.json` file that defines different resources (like the API URL) depending on if you're using a dev or prod version.

If you're running in development mode, just create a build first to do this:

```sh
# Make resources for dev mode
npm run make-dev

# Make resources for prod mode
npm run make-prod

# Start the app
npm run start
```

## Making releases

Do all of these before making a release:

- [ ] Make a PR where you bump the version in `package.json` and run `npm install`, and merge it
- [ ] Create a release and tag in GitHub

**To make the release:**

Mac build machine:

- [ ] macOS universal: host
  - `npm run publish-dev-macos`
- [ ] Windows arm64: Windows VM (arm64)
  - need the HARICA token PIN
  - `npm run publish-dev-windows`

Ubuntu build machine:

- [ ] Linux amd64 and Linux arm64:
  - wait for "Release for Linux" GitHub Actions workflow to finish
  - need the PGP passphrase
  - `./scripts/release-dev.sh` (from `linux-repos` repo)
- [ ] Windows x64: Windows VM
  - need the HARICA token PIN
  - `npm run publish-dev-windows`

Finally:

- [ ] Login to admin site and update the version string to the new version

### Windows

Do this process in a Windows VM in both x64 with VirtualBox and arm64 VMWare Fusion.

To set up Windows:

- **Make sure the Windows user does not have spaces in the filename (e.g., "user", not "Micah Lee")!**
- Install Windows SDK (`winget install Microsoft.WindowsSDK.10.0.26100`)
  - add `C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64` to the PATH (even on arm64, you should use teh x64 binary)
  - example code signing: `signtool.exe sign /v /d "Calculator" /n "Lockdown Systems LLC" /fd sha256 /td sha256 /tr http://ts.harica.gr .\calc.exe`
- Set up code signing
  - Install [Safenet Authentication Client](https://guides.harica.gr/docs/Guides/Software/Safenet-Authentication-Client/Drivers/)
  - Login to [HARICA](https://cm.harica.gr/), download the cert in DER and DER CA format, and install in Windows
- Install Git: `winget install git.git` (and make sure the Cyd repo has a deploy key for Windows)
- Install Node.JS LTS (`winget install OpenJS.NodeJS.LTS`)
- Install SSH, in an administrator PowerShell: `Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0`
- Set PowerShell execution policy, in an administrator PowerShell: `Set-ExecutionPolicy -ExecutionPolicy Bypass`
- While you're at it, install VSCode: `winget install Microsoft.VisualStudioCode`
- Clone the Cyd repo (to a folder with no spaces!)
- Make sure you have the following environment variables set:
  - `DO_SPACES_KEY`
  - `DO_SPACES_SECRET`
- Plug in HARICA USB token and have the PIN ready

Build Cyd

```powershell
cd .\code\Cyd

# Make a release and test it
npm run make-dev-windows
npm run make-prod-windows

# Publish a release
npm run publish-dev-windows
npm run publish-prod-windows
```

### macOS

To set up macOS:

- Install Xcode from the App Store, and set up code signing certificates
  - Xcode > Settings
  - Accounts tab
  - Sign into Apple ID, and create:
    - Developer ID Application
    - Developer ID Installer
    - Apple Development
- Install [Node.js LTS](https://nodejs.org/en)
- Make sure you have the following environment variables set:
  - `DO_SPACES_KEY`
  - `DO_SPACES_SECRET`
  - `APPLE_ID`
  - `APPLE_PASSWORD`

Build Cyd:

```sh
cd code/Cyd

# Make a release and test it
npm run make-dev-macos
npm run make-prod-macos

# Publish a release
npm run publish-dev-macos
npm run publish-prod-macos
```

### Linux

To set up Debian 12:

- `sudo apt install -y build-essential curl git rpm zip`
- Install [Node.js LTS](https://nodejs.org/en/download/package-manager) on Linux using nvm
- Clone the Cyd repo

Build Cyd:

```sh
cd code/Cyd

# Make a release and test it
npm run make-dev-linux
npm run make-prod-linux
```

To publish a release for linux/amd64 and linux/arm64, run this on an Apply Silicon Mac with Docker installed:

```sh
# Publish release
./scripts/publish-dev-linux.sh
./scripts/publish-prod-linux.sh

# Then follow the instructions to copy the release to linux-repos
```
