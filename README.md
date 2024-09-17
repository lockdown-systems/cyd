# Semiphemeral Desktop

The environment variable `SEMIPHEMERAL_ENV` is used to determine the API URL. The options are:

- `dev`: the dev server at https://dev-api.semiphemeral.com/v1/
- `prod` (default): the prod server at http://api.semiphemeral.com/v1/

If you want devtools to open up, set `SEMIPHEMERAL_DEVTOOLS=1`.

You must clone the submodule and build the API client first:

```sh
git submodule init
git submodule update
cd semiphemeral-api-client/
npm install
npm run build
```

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

### Windows

To set up Windows:

- Install [Windows SDK](https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/)
- Install [git](https://git-scm.com/download/win) (and make sure the Semiphemeral repo has a deploy key for Windows)
- Install SSH, in an administrator PowerShell: `Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0`
- Install [Node.js LTS](https://nodejs.org/en)
- Clone the Semiphemeral repo to `~\code\Semiphemeral`

Build Semiphemeral

```powershell
cd .code\Semiphemeral
npm install
```

### Linux

To set up Ubuntu:

- `sudo apt install -y curl git`
- Install [Node.js LTS](https://nodejs.org/en/download/package-manager) on Linux using nvm
