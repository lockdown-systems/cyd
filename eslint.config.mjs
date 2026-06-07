import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default tseslint.config(
  {
    ignores: [
      "eslint.config.ts",
      "vitest.config.ts",
      "vite.*.config.ts",
      ".vite/**/*",
      "build/**/*",
      "out/**/*",
      "coverage/**/*",
      "node_modules/**/*",
      "src/renderer/vite.config.ts",
      "global.d.ts",
      "forge.env.d.ts",
      "docs/**/*",
    ],
  },
  // TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      eslintConfigPrettier,
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Disable preserve-caught-error - our packageExceptionForReport() intentionally
      // serializes errors for reporting without preserving the cause chain
      "preserve-caught-error": "off",
      // Disable no-useless-assignment - too strict for development/debugging patterns
      "no-useless-assignment": "off",
    },
  },
  // Vue files
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: pluginVue.parser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    extends: [pluginVue.configs["flat/recommended"], eslintConfigPrettier],
    rules: {
      // Disable preserve-caught-error - our packageExceptionForReport() intentionally
      // serializes errors for reporting without preserving the cause chain
      "preserve-caught-error": "off",
      // Disable no-useless-assignment - too strict for development/debugging patterns
      "no-useless-assignment": "off",
    },
  },
);
