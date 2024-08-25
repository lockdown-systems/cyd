# Semiphemeral Desktop

The environment variable `SEMIPHEMERAL_ENV` is used to determine the API URL. The options are:

- `dev`: the dev server at https://dev-api.semiphemeral.com/v1/
- `prod` (default): the prod server at http://api.semiphemeral.com/v1/

If you want devtools to open up, set `SEMIPHEMERAL_DEVTOOLS=1`.

Run in development mode:

```sh
npm run start
```

## Creating archives

When you create an archive of data from an account, it needs to unzip an archive static site. To do this, you need to build the static site first and zip it up. This happens automatically when creating a build, but if you're running in development mode, just create a build first to do this:

```sh
npm run make
```