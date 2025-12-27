# Cyd Mobile

This is the code for Cyd for iOS and Android. It's implemented with Expo and React Native.

## Database

The app persists account metadata in a SQLite database (via [`expo-sqlite`](https://docs.expo.dev/versions/latest/sdk/sqlite/)). The shared database lives at `cyd-mobile/database` and is initialized on launch.

### Creating a migration

1. Open `database/migrations.ts`.
2. Append a new migration object with a `version` greater than the current maximum.
3. Add one or more SQL statements that are **idempotent** and valid for already-migrated databases. Keep destructive changes behind checks (e.g., `IF NOT EXISTS`).
4. Save the file and restart the Expo dev server (or reload the app). On boot, the `getDatabase()` helper will run any pending migrations automatically.

### Development seed data

When `__DEV__` is true and there are zero rows in `account`, `ensureDevSeedData()` inserts two sample Bluesky accounts. This keeps the Account Selection screen populated without requiring manual database work.
