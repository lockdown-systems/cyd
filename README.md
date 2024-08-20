# Semiphemeral Desktop

The environment variable `SEMIPHEMERAL_ENV` is used to determine the API URL. The options are:

- `dev`: the dev server at https://dev-api.semiphemeral.com/v1/
- `prod` (default): the prod server at http://api.semiphemeral.com/v1/

If you want devtools to open up, set `SEMIPHEMERAL_DEVTOOLS=1`.

Run in development mode:

```
npm run start
```