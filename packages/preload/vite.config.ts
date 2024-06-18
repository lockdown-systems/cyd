import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

export default defineConfig({
    // Please note that `__dirname = packages/preload` in this context.
    root: __dirname,
    // The directory from which `.env` files are loaded.
    // Make sure it should be at the root of the project.
    envDir: process.cwd(),

    build: {
        // Add inline sourcemap
        sourcemap: 'inline',
        // Build output inside `dist/preload` at the project root.
        outDir: '../../dist/preload',

        emptyOutDir: true,

        // Build preload in "lib" mode of Vite.
        // See: https://vitejs.dev/guide/build.html#library-mode
        lib: {
            // Specify the entry-point.
            entry: 'src/index.ts',
            // Electron supports CommonJS.
            formats: ['cjs'],
        },

        rollupOptions: {
            external: [
                // Exclude all Electron imports from the build.
                'electron',
                // Exclude Node internals from the build.
                ...builtinModules.flatMap((p) => [p, `node:${p}`]),
            ],

            output: {
                // Specify the name pattern of the file, which will be `index.cjs` in our case.
                entryFileNames: '[name].cjs',
            },
        },
    },
});
