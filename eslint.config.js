const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const pluginVue = require('eslint-plugin-vue');

module.exports = tseslint.config(
    {
        ignores: [
            'dist/',
            'src/renderer/cypress.config.cjs',
            'src/renderer/cypress/',
            'eslint.config.js',
            'forge.config.ts',
            'forge.env.d.ts',
            'vite.*.config.ts',
            '.vite/',
            'src/renderer/.vite/'
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