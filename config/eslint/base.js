import { posix } from 'node:path';

import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { importSortGroups } from './aliases.js';

// Every rule here is `error` or `off`; its class (a: auto-fixable, b: correctness or boundary)
// is recorded in config/eslint/rule-classes.json (spec 02 §D0). Class c rules are not added.

/** Files the ESLint presets apply to. */
export const LINT_FILES = '**/*.{ts,tsx,js,jsx}';

/**
 * Resolves a glob relative to the app directory (`'.'` now, `'apps/app'` after the monorepo move).
 * @param {string} appDir
 * @param {string} pattern
 */
export const appGlob = (appDir, pattern) => posix.join(appDir, pattern);

/** JS + typescript-eslint recommended, unused imports, import sorting. */
export const baseConfig = ({ appDir }) =>
    tseslint.config(
        { ignores: [appGlob(appDir, 'dist')] },
        {
            extends: [js.configs.recommended, ...tseslint.configs.recommended],
            files: [LINT_FILES],
            languageOptions: {
                ecmaVersion: 2020,
                globals: globals.browser,
            },
            plugins: {
                'simple-import-sort': simpleImportSort,
                'unused-imports': unusedImports,
            },
            rules: {
                curly: ['error', 'all'],
                // Unused variables are reported by @typescript-eslint/no-unused-vars and tsc.
                'no-unused-vars': 'off',
                'unused-imports/no-unused-imports': 'error',
                'simple-import-sort/exports': 'error',
                // Groups are built from the tsconfig.app.json `paths` aliases (aliases.js).
                'simple-import-sort/imports': ['error', { groups: importSortGroups({ appDir }) }],
            },
        },
    );

/** Prettier owns formatting: keep this preset last. */
export const formattingConfig = () => [
    eslintConfigPrettier,
    {
        // eslint-config-prettier turns these off; both are safe with Prettier.
        // `curly: all` never conflicts; `no-unexpected-multiline` is a correctness rule.
        files: [LINT_FILES],
        rules: {
            curly: ['error', 'all'],
            'no-unexpected-multiline': 'error',
        },
    },
];
