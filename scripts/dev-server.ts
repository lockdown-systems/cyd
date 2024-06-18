import { InlineConfig, ViteDevServer, build, createLogger, createServer } from 'vite'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import electronPath from 'electron'

// Shared config across multiple build watchers.
const sharedConfig: InlineConfig = {
    mode: 'development',
    build: { watch: {} },
}

const stripNewlinesAtEnd = (str: string): string => {
    return str.replace(/\n+$/, '');
}

/**
 * Create a Vite build watcher that automatically recompiles when a file is
 * edited.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getWatcher = (name: string, configFilePath: string, writeBundle: any) =>
    build({
        ...sharedConfig,
        configFile: configFilePath,
        plugins: [{ name, writeBundle }],
    })

/**
 * Setup a watcher for the preload package.
 */
const setupPreloadWatcher = async (viteServer: ViteDevServer) =>
    getWatcher('reload-app-on-preload-package-change', 'packages/preload/vite.config.ts', () => {
        // Send a "full-reload" page event using Vite WebSocket server.
        viteServer.ws.send({ type: 'full-reload' })
    })

/**
 * Setup the `main` watcher.
 */
const setupMainWatcher = async () => {
    createLogger('info', { prefix: '[main]' })
    let spawnProcess: ChildProcessWithoutNullStreams | null = null

    return getWatcher('reload-app-on-main-package-change', 'packages/main/vite.config.ts', () => {
        if (spawnProcess !== null) {
            spawnProcess.off('exit', () => process.exit(0))
            spawnProcess.kill('SIGINT')
            spawnProcess = null
        }

        // Restart Electron process when main package is edited and recompiled
        spawnProcess = spawn(String(electronPath), ['.'])
        spawnProcess.stdout.on('data', (data: Buffer) => {
            console.log(`\x1b[32mstdout:\x1b[0m ${stripNewlinesAtEnd(data.toString())}`);
        });
        spawnProcess.stderr.on('data', (data: Buffer) => {
            console.error(`\x1b[31mstderr:\x1b[0m ${stripNewlinesAtEnd(data.toString())}`);
        });
        spawnProcess.on('close', (code: number) => {
            console.log(`child process exited with code ${code}`);
            process.exit(0);
        });
    })
}

(async () => {
    try {
        const rendererServer = await createServer({
            ...sharedConfig,
            configFile: 'packages/renderer/vite.config.ts',
        })

        await rendererServer.listen()
        rendererServer.printUrls()

        await setupPreloadWatcher(rendererServer)
        await setupMainWatcher()
    } catch (err) {
        console.error(err)
    }
})().catch((err) => console.error(err))