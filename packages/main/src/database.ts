// import { app } from 'electron';
// import log from 'electron-log/main';
// import path from 'path';

// import { DataSource } from "typeorm"
// import { Config } from "./models/Config"

// export function initializeDatabase() {
//     // const appDatabasePath = path.join(app.getPath('userData'), 'database.sqlite')
//     const appDatabasePath = 'database.sqlite'
//     log.info('Database path:', appDatabasePath)

//     return new DataSource({
//         type: "sqlite",
//         database: appDatabasePath,
//         synchronize: true,
//         logging: true,
//         entities: [Config],
//         subscribers: [],
//         migrations: [],
//     })
// }