import log from 'electron-log/main';
import Database from 'better-sqlite3'

const run = async (db: Database) => {
    const migrations = [
        {
            name: "initial",
            sql: [
                `
                CREATE TABLE config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL UNIQUE,
                    value TEXT NOT NULL
                );
                `, `
                CREATE TABLE account (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL DEFAULT 'unknown',
                    sortOrder INTEGER NOT NULL DEFAULT 0,
                    xAccountId INTEGER DEFAULT NULL
                );
                `, `
                CREATE TABLE xAccount (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    accessedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    username TEXT,
                    archiveTweets BOOLEAN DEFAULT 1,
                    archiveDirectMessages BOOLEAN DEFAULT 1,
                    deleteTweets BOOLEAN DEFAULT 0,
                    deleteTweetsDaysOld INTEGER DEFAULT 30,
                    deleteTweetsLikesThresholdEnabled BOOLEAN DEFAULT 1,
                    deleteTweetsLikesThreshold INTEGER DEFAULT 20,
                    deleteTweetsRetweetsThresholdEnabled BOOLEAN DEFAULT 1,
                    deleteTweetsRetweetsThreshold INTEGER DEFAULT 20,
                    deleteRetweets BOOLEAN DEFAULT 0,
                    deleteRetweetsDaysOld INTEGER DEFAULT 30,
                    deleteLikes BOOLEAN DEFAULT 0,
                    deleteLikesDaysOld INTEGER DEFAULT 60,
                    deleteDirectMessages BOOLEAN DEFAULT 0,
                    deleteDirectMessagesDaysOld INTEGER DEFAULT 30
                );
                `,
            ]
        }
    ];

    // Create a migrations table if necessary
    const migrationsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'").get();
    if (!migrationsTable) {
        // Create the migrations table
        log.info("Creating migrations table");
        db.prepare(`
            CREATE TABLE  migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                name TEXT NOT NULL, 
                runAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
    }

    // Apply the migrations in order
    for (const migration of migrations) {
        const migrationRecord = db.prepare("SELECT * FROM migrations WHERE name = ?").get(migration.name);
        if (!migrationRecord) {
            log.info(`Running migration: ${migration.name}`);
            for (const sql of migration.sql) {
                db.exec(sql);
            }
            db.prepare("INSERT INTO migrations (name) VALUES (?)").run(migration.name);
        }
    }
}

export default run;