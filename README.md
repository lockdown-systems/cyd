# Semiphemeral Desktop

The environment variable `SEMIPHEMERAL_ENV` is used to determine the API URL. The options are:

- `local`: local development on a laptop, http://127.0.0.1:8080/v1/
- `dev`: the dev server at https://dev-api.semiphemeral.com/v1/
- `prod`: the prod server at http://api.semiphemeral.com/v1/

If it's not set, it defaults to `prod`.

You need Chromium and SingleFile CLI downloaded for archiving to work in dev. To download, just make a build:

```
npm run make
```