import path from "path";
import { fork } from "child_process";

import { app } from 'electron'
import log from 'electron-log/main';
import { PrismaClient } from '@prisma/client/index';

// Determine the sqlite database URL
const dbUrl = `file:${path.join(app.getPath('userData'), 'db.sqlite')}`;

// Initialize the database client
export const prisma = new PrismaClient({
    datasources: {
        db: {
            url: dbUrl
        }
    }
})

// Find the location of the migration engine and query engine
interface ExecutablePaths {
    schemaEngine: string;
    queryEngine: string;
}

type PlatformExecutables = {
    [key: string]: ExecutablePaths;
};

const platformToExecutables: PlatformExecutables = {
    win32: {
        schemaEngine: 'node_modules/@prisma/engines/schema-engine-windows.exe',
        queryEngine: 'node_modules/@prisma/engines/query_engine-windows.dll.node',
    },
    linux: {
        schemaEngine: 'node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x',
        queryEngine: 'node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node'
    },
    darwin: {
        schemaEngine: 'node_modules/@prisma/engines/schema-engine-darwin',
        queryEngine: 'node_modules/@prisma/engines/libquery_engine-darwin.dylib.node'
    },
    darwinArm64: {
        schemaEngine: 'node_modules/@prisma/engines/schema-engine-darwin-arm64',
        queryEngine: 'node_modules/@prisma/engines/libquery_engine-darwin-arm64.dylib.node',
    }
};
const extraResourcesPath = app.getAppPath().replace('app.asar', '');

// Determine the platform name
let platformName;
const isDarwin = process.platform === "darwin";
if (isDarwin && process.arch === "arm64") {
    platformName = process.platform + "Arm64";
} else {
    platformName = process.platform;
}

// Find some other important paths
const schemaEnginePath = path.join(
    extraResourcesPath,
    platformToExecutables[platformName].schemaEngine
);
const queryEnginePath = path.join(
    extraResourcesPath,
    platformToExecutables[platformName].queryEngine
);

// Run a Prisma command
export async function runPrismaMigrations(): Promise<number> {
    const schemaPath = path.join(
        app.getAppPath().replace('app.asar', 'app.asar.unpacked'),
        'prisma',
        "schema.prisma"
    );
    const command = ["migrate", "deploy", "--schema", schemaPath];

    // Currently we don't have any direct method to invoke prisma migration programatically.
    // As a workaround, we spawn migration script as a child process and wait for its completion.
    // Please also refer to the following GitHub issue: https://github.com/prisma/prisma/issues/4703
    try {
        const exitCode = await new Promise((resolve, _) => {
            const prismaPath = path.resolve(__dirname, "..", "..", "node_modules/prisma/build/index.js");

            const child = fork(
                prismaPath,
                command,
                {
                    env: {
                        ...process.env,
                        DATABASE_URL: dbUrl,
                        PRISMA_SCHEMA_ENGINE_BINARY: schemaEnginePath,
                        PRISMA_QUERY_ENGINE_LIBRARY: queryEnginePath,

                        // Prisma apparently needs a valid path for the format and introspection binaries, even though
                        // we don't use them. So we just point them to the query engine binary. Otherwise, we get
                        // prisma:  Error: ENOTDIR: not a directory, unlink '/some/path/electron-prisma-trpc-example/packed/mac-arm64/ElectronPrismaTrpcExample.app/Contents/Resources/app.asar/node_modules/@prisma/engines/prisma-fmt-darwin-arm64'
                        PRISMA_FMT_BINARY: queryEnginePath,
                        PRISMA_INTROSPECTION_ENGINE_BINARY: queryEnginePath
                    },
                    stdio: "pipe"
                }
            );

            child.on("message", msg => {
                log.info(msg);
            })

            child.on("error", err => {
                log.error("Child process got error:", err);
            });

            child.on("close", (code, _signal) => {
                resolve(code);
            })

            child.stdout?.on('data', function (data) {
                log.info("prisma: ", data.toString());
            });

            child.stderr?.on('data', function (data) {
                log.error("prisma: ", data.toString());
            });
        });

        if (exitCode !== 0) throw Error(`command ${command} failed with exit code ${exitCode}`);

        return exitCode;
    } catch (e) {
        log.error(e);
        throw e;
    }
}