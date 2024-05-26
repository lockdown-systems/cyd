# Semiphemeral Desktop

Useful blog post for setting up Electron, Vite.js, Vue.js, with TypeScript: https://www.jsgarden.co/blog/electron-with-typescript-and-vite-as-a-build-system

The environment variable `SEMIPHEMERAL_ENV` is used to determine the API URL. It can be `local` (as in local development on a laptop, http://127.0.0.1:8080/api/v1/), `staging` (the staging server at https://staging-semiphemeral.fly.dev/api/v1/), or `prod` (the prod server at http://semiphemeral.com/api/v1/). If it's not set, it defaults to `prod`.

## API for renderer to call to main

### Errors

Every API request includes the keys `error` (boolean). If there's no error, there will be a `response`, and if there's an error, there will be a `message`.

### Endpoints

#### Check what user is logged in

This returns the logged in user, or null if the user is not logged in yet.

- Function: `getUser`
- Channel: `get-user`
- Args: none

Example response for a logged-in user:

```json
{
    "error": false,
    "response": {
        "email": "example@lockdown.systems"
    }
}
```

Example response for a user who is not logged in:

```json
{
    "error": false,
    "response": {
        "email": null
    }
}
```

#### Authenticate with an email address

- Function: `authenticate`
- Channel: `authenticate`
- Args: `email` (string)

This authenticates with the server and triggers a one-time code to get emailed. 

Example response:

```json
{
    "error": false,
    "response": {}
}
```

#### Get an authentication token

- Function: `token`
- Channel: `token`
- Args: `email` (string), `oneTimeCode` (string)

This retrieves a token from the server.

```json
{
    "error": false,
    "response": {
        "token": "eyJhbGciOiJIUzI1NiIsImV4cCI6MTUzMTE5Njk4MSwiaWF0IjoxNTMxMTY4MTgxfQ.eyJpZCI6MX0.TBSvfrICMxtvWgpVZzqTl6wHYNQuGPOaZpuAKwwIXXo"
    }
}
```
