import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default tseslint.config(
    {
        ignores: [
            'dist/',
            'packages/renderer/cypress.config.cjs',
            'packages/renderer/cypress/',
            'eslint.config.js',
            'packages/main/vite.config.ts',
            'scripts/dev-server.ts',
            'forge.config.ts',
            'forge.env.d.ts',
            `vite.*.config.ts`,
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
        plugins: {
            'typescript-eslint': tseslint.plugin,
        },
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
                project: './packages/**/tsconfig.json',
                extraFileExtensions: ['.vue'],
                sourceType: 'module',
            },
        },
    },
    {
        // Ignore @typescript-eslint/no-unused-vars that start with underscore
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],
            // Ignore Vue style rules that conflict with my auto-formatting
            'vue/max-attributes-per-line': 'off',
            'vue/html-indent': 'off',
            'vue/html-closing-bracket-newline': 'off',
            'vue/first-attribute-linebreak': 'off',
            // It's okay for me to use v-html because of no user-provided input in speech bubbles
            'vue/no-v-html': 'off',
        },
    }
);