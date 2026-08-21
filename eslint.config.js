import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import js from '@eslint/js';

export default tseslint.config(
    { ignores: ['dist'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx,js,jsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            react,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            'simple-import-sort': simpleImportSort,
            'unused-imports': unusedImports,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            curly: ['error', 'all'], // always use {}

            // For remove ununsed imports
            'no-unused-vars': 'off', // or "@typescript-eslint/no-unused-vars": "off",
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                },
            ],

            // For sort imports
            'simple-import-sort/exports': 'warn',
            'simple-import-sort/imports': [
                'warn',
                {
                    groups: [
                        // Node.js builtins
                        ['^node:'],
                        // External packages (npm)
                        ['^react$', '^react-dom$', '^\\w'],
                        // Aliases (e.g. @mui/material, @custom/*)
                        ['^@\\w'],
                        // Absolute imports from project (like 'basics/', 'components/', 'src/')
                        ['^api/', '^constants/', '^helpers/', '^hooks/', '^store/'],
                        ['^basics/', '^components/', '^features/', '^pages/'],
                        ['^assets/', '^styles/', '^src/'],
                        // Relative imports up
                        ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
                        // Relative imports current folder
                        ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
                        // Style imports
                        ['^.+\\.s?css$'],
                    ],
                },
            ],

            'no-multiple-empty-lines': [
                'warn',
                {
                    max: 1,
                    maxEOF: 0,
                    maxBOF: 0,
                },
            ],

            /* ===============================
               i18n / UI TEXT RULES
               =============================== */

            // Disallow string literals in JSX (force i18n)
            'react/jsx-no-literals': [
                'error',
                {
                    noStrings: true,
                    ignoreProps: true,
                    allowedStrings: [' ', '-', '+', '/', '~'],
                },
            ],

            /* ===============================
               MIGRATION GUARDRAILS
               =============================== */

            // Legacy violations remain warnings until their baseline is cleared.
            'no-restricted-syntax': [
                'warn',
                {
                    selector:
                        'FunctionDeclaration[async=true]:not(:has(AwaitExpression)):not(:has(ForOfStatement[await=true]))',
                    message: 'Use a returned Promise chain instead of async/await.',
                },
                {
                    selector:
                        'FunctionExpression[async=true]:not(:has(AwaitExpression)):not(:has(ForOfStatement[await=true]))',
                    message: 'Use a returned Promise chain instead of async/await.',
                },
                {
                    selector:
                        'ArrowFunctionExpression[async=true]:not(:has(AwaitExpression)):not(:has(ForOfStatement[await=true]))',
                    message: 'Use a returned Promise chain instead of async/await.',
                },
                {
                    selector: 'AwaitExpression',
                    message: 'Use .then(), .catch(), and .finally() instead of await.',
                },
                {
                    selector: 'ForOfStatement[await=true]',
                    message: 'Use a Promise-chain iteration instead of for await.',
                },
            ],
            '@typescript-eslint/naming-convention': [
                'warn',
                {
                    selector: 'default',
                    format: null,
                    custom: {
                        regex: '^handle[A-Z0-9_]',
                        match: false,
                    },
                },
            ],
            'no-restricted-globals': [
                'error',
                {
                    name: 'localStorage',
                    message: 'Use the typed helper in helpers/localStorage.ts.',
                },
            ],
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: 'axios',
                            message: 'Use the configured Axios instance from src/api.',
                        },
                        {
                            name: 'bignumber.js',
                            message: 'BigNumber is restricted to the existing legacy number layer.',
                        },
                    ],
                },
            ],
        },
    },

    /* ===============================
       IMPORT AND BROWSER BOUNDARIES
       =============================== */
    {
        files: ['src/api/chipin.instance.ts', 'src/api/chipin.interceptors.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: 'bignumber.js',
                            message: 'BigNumber is restricted to the existing legacy number layer.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: [
            'src/pages/**/*.{ts,tsx}',
            'src/features/**/*.{ts,tsx}',
            'src/components/**/*.{ts,tsx}',
            'src/basics/**/*.{ts,tsx}',
        ],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: 'axios',
                            message: 'UI must call stores or hooks, not Axios.',
                        },
                        {
                            name: 'bignumber.js',
                            message: 'BigNumber is restricted to the existing legacy number layer.',
                        },
                    ],
                    patterns: [
                        {
                            regex: '^(?:api/|(?:\\.\\.?/)+(?:[^/]+/)*api/)(?!.*\\.types(?:\\.[cm]?[jt]sx?)?$)',
                            allowTypeImports: true,
                            message: 'UI must call a store action instead of a runtime API module.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['src/helpers/numbers.ts', 'src/basics/numbers/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: 'axios',
                            message: 'The number layer cannot call Axios.',
                        },
                    ],
                    patterns: [
                        {
                            regex: '^(?:api/|(?:\\.\\.?/)+(?:[^/]+/)*api/)(?!.*\\.types(?:\\.[cm]?[jt]sx?)?$)',
                            allowTypeImports: true,
                            message: 'The number layer cannot call runtime API modules.',
                        },
                    ],
                },
            ],
        },
    },
    {
        // Existing auth transport helper narrows Axios errors; migrate it with the auth flow.
        files: ['src/helpers/authSession.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: 'bignumber.js',
                            message: 'BigNumber is restricted to the existing legacy number layer.',
                        },
                    ],
                },
            ],
            '@typescript-eslint/no-restricted-imports': [
                'warn',
                {
                    paths: [
                        {
                            name: 'axios',
                            message: 'Legacy exception: do not expand Axios usage in this helper.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['src/helpers/localStorage.ts'],
        rules: {
            'no-restricted-globals': 'off',
        },
    },
);
