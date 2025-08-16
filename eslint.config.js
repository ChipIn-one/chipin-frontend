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
        },
    },
);
