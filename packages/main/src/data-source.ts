import "reflect-metadata"
import { DataSource } from "typeorm"
import { XService } from "./entity/XService"

export const AppDataSource = new DataSource({
    type: "sqlite",
    database: "database.sqlite",
    synchronize: true,
    logging: false,
    entities: [XService],
    migrations: [],
    subscribers: [],
})
