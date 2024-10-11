# Semiphemeral Desktop

The environment variable `SEMIPHEMERAL_ENV` is used to determine the API URL. The options are:

- `dev`: the dev server at https://dev-api.semiphemeral.com/v1/
- `prod` (default): the prod server at http://api.semiphemeral.com/v1/

If you want devtools to open up, set `SEMIPHEMERAL_DEVTOOLS=1`.

Before you can run in development mode, you must create a build (either `npm run build-local`, `npm run build-dev`, etc.), in order to define the mode (local, dev, or prod).

Run in development mode:

```sh
npm run start
```

## Initializing resources

Semiphemeral requires resources to be created before you run it.

When you create an archive of data from an account, it needs to unzip an archive static site. To do this, you need to build the static site first and zip it up. This happens automatically when creating a build.

There's also a `config.json` file that defines different resources (like the API URL) depending on if you're using a dev or prod version.

If you're running in development mode, just create a build first to do this:

```sh
# Make resources for dev mode
npm run make-dev

# Make resources for prod mode
npm run make-prod
```

## Making releases

Do all of these before making a release:

- Bump the version in `package.json`
- Run the tests
- Manually test with `npm run start` to make sure nothing glaring is broken

### Windows

To set up Windows:

- **Make sure the Windows user does not have spaces in the filename (e.g., "user", not "Micah Lee")!**
- Install [Windows SDK](https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/), and add `C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64` to the PATH
  - Example code signing: `signtool.exe sign /v /d "Calculator" /n "Lockdown Systems LLC" /fd sha256 /td sha256 /tr http://timestamp.digicert.com .\calc.exe`
- Install [git](https://git-scm.com/download/win) (and make sure the Semiphemeral repo has a deploy key for Windows)
- Install [Node.js LTS](https://nodejs.org/en)
- Install SSH, in an administrator PowerShell: `Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0`
- Set PowerShell execution policy, in an administrator PowerShell: `Set-ExecutionPolicy -ExecutionPolicy Bypass`
- Clone the Semiphemeral repo (to a folder with no spaces!)

Build Semiphemeral

```powershell
cd .\code\Semiphemeral
npm run make-dev-windows
npm run make-prod-windows
```

### Linux

To set up Debian 12:

- `sudo apt install -y build-essential curl git rpm zip`
- Install [Node.js LTS](https://nodejs.org/en/download/package-manager) on Linux using nvm
- Clone the Semiphemeral repo

Build Semiphemeral

```sh
cd code/Semiphemeral
npm run make-dev
npm run make-prod
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
npm run make-dev-macos
npm run make-prod-macos
```
