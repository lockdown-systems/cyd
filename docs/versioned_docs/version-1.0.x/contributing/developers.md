---
sidebar_position: 2
---

# For Developers

Cyd is a desktop app for Windows, Mac, and Linux written in Node.js. To run Cyd locally, all you need is [Node.JS LTS](https://nodejs.org/en) for your operating systems.

Install dependencies.

```sh
npm install
```

Configure your Cyd environment to use "open" mode. This disables the server, which allows outside contributors to build features.

```sh
npm run config-open
```

Run Cyd:

```sh
npm run start
```

To make it so devtools automatically opens, and so each embedded webview has a separate devtools window open, set the environment variables `CYD_DEV` to `1`:

```sh
CYD_DEV=1
npm run start
```

Run the tests:

```sh
# Node.js tests
npm run test

# Vue.js component tests
npm run test:components
```

## Other server modes

If you're an outside contributor you'll want to use "open" mode, as described above.

If you're part of Lockdown Systems and you need to test functionality that uses the server, you need "local", "dev", or "prod" mode:

```sh
# local mode: use a locally-hosted server at localhost:5000
npm run config-local

# dev mode: use the dev server at dev-api.cyd.social
npm run config-dev

# prod mode: use the prod server at prod-api.cyd.social
npm run config-prod
```