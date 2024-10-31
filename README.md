# Cyd

The environment variable `CYD_ENV` is used to determine the API URL. The options are:

- `dev`: the dev server at https://dev-api.semiphemeral.com/v1/
- `prod` (default): the prod server at http://api.semiphemeral.com/v1/

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

- [ ] Bump the version in `package.json`
- [ ] Manually test with `npm run start` and make sure it runs
- [ ] Make a release, install it, and run the installed binary, and make sure it runs

To make the release:

- [ ] Windows x64: Ubuntu build machine, in Windows VM
- [ ] Windows arm64: Mac build machine, in Windows VM (arm64)
- [ ] macOS universal: Mac build machine, host
- [ ] Linux amd64 and Linux arm64: Mac build machine, Docker

### Windows

Do this process in a Windows VM in both x64 with VirtualBox and arm64 [with UTM](https://docs.getutm.app/guides/windows/).

To set up Windows:

- **Make sure the Windows user does not have spaces in the filename (e.g., "user", not "Micah Lee")!**
- Install [Windows SDK](https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/), and add `C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64` to the PATH (even on arm64, you should use teh x64 binary)
  - Example code signing: `signtool.exe sign /v /d "Calculator" /n "Lockdown Systems LLC" /fd sha256 /td sha256 /tr http://timestamp.digicert.com .\calc.exe`
- Set up code signing
  - Install [Safenet Authentication Client](https://guides.harica.gr/docs/Guides/Software/Safenet-Authentication-Client/Drivers/)
  - Login to [HARICA](https://cm.harica.gr/), download the cert in DER and DER CA format, and install in Windows
- Install [git](https://git-scm.com/download/win) (and make sure the Semiphemeral repo has a deploy key for Windows)
- Install [Node.js LTS](https://nodejs.org/en)
- Install SSH, in an administrator PowerShell: `Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0`
- Set PowerShell execution policy, in an administrator PowerShell: `Set-ExecutionPolicy -ExecutionPolicy Bypass`
- Clone the Semiphemeral repo (to a folder with no spaces!)
- Make sure you have the following environment variables set:
  - `DO_SPACES_KEY`
  - `DO_SPACES_SECRET`
- Plug in HARICA USB token and have the PIN ready

Build Semiphemeral

```powershell
cd .\code\Semiphemeral

# Make a release and test it
npm run make-dev-windows
npm run make-prod-windows

# Publish a release
npm run publish-dev-windows
npm run publish-prod-windows
```

### macOS

To set up macOS:

- I'm having trouble getting this working in a VM, so instead just do it natively in macOS.
- I'll update these docs next time I rebuild my Mac...
- Make sure you have the following environment variables set:
  - `DO_SPACES_KEY`
  - `DO_SPACES_SECRET`
  - `APPLE_ID`
  - `APPLE_PASSWORD`

Build Semiphemeral:

```sh
cd code/Semiphemeral

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
- Clone the Semiphemeral repo

Build Semiphemeral:

```sh
cd code/Semiphemeral

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
