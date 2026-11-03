import { posix, resolve } from 'node:path';

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

/** TypeScript files: the type-aware rules apply only to them (JS files get no type information). */
export const TS_FILES = '**/*.{ts,tsx}';

// TypeScript files outside every tsconfig `include` (repository scripts and their tests). The
// project service lints them with the compiler options of tsconfig.node.json (spec 02 §D5).
const DEFAULT_PROJECT_FILES = ['scripts/*.ts'];

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
                // Unused variables are reported only by tsc `noUnused*` (spec 02 §D5).
                'no-unused-vars': 'off',
                '@typescript-eslint/no-unused-vars': 'off',
                'unused-imports/no-unused-imports': 'error',
                'simple-import-sort/exports': 'error',
                // Groups are built from the tsconfig.app.json `paths` aliases (aliases.js).
                'simple-import-sort/imports': ['error', { groups: importSortGroups({ appDir }) }],
            },
        },
    );

/**
 * Type-aware rules (spec 02 §D5): the explicit list of §D0, not the whole `recommendedTypeChecked`.
 * Type information comes from the project service; the tsconfig root is the app directory.
 */
export const typeAwareConfig = ({ appDir }) => [
    {
        files: [TS_FILES],
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: DEFAULT_PROJECT_FILES,
                    defaultProject: 'tsconfig.node.json',
                },
                tsconfigRootDir: resolve(import.meta.dirname, '../..', appDir),
            },
        },
        rules: {
            // Inv. 7: a promise is returned, awaited, or marked `void`.
            '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
            // Inv. 7: no promise where void is expected, JSX attributes included:
            // `onClick={() => void action()}`.
            '@typescript-eslint/no-misused-promises': [
                'error',
                { checksVoidReturn: { attributes: true } },
            ],
            // Inv. 6: `any` does not leak into typed code.
            '@typescript-eslint/no-unsafe-argument': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',
            '@typescript-eslint/no-unnecessary-type-assertion': 'error',
            // Type-only imports are explicit (tsc `verbatimModuleSyntax`); all three are autofixed.
            // `typeof import('x')` annotations stay allowed: they have no autofix (class a, §D0)
            // and are the vitest idiom `vi.importActual<typeof import('x')>`.
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
            ],
            '@typescript-eslint/no-import-type-side-effects': 'error',
        },
    },
    {
        // vi.fn()/expect patterns in tests.
        files: ['**/*.test.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
        },
    },
];

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
