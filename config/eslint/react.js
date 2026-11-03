import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

import { LINT_FILES } from './base.js';

// There is no `warn` level (spec 02 §D0): the hooks preset's warnings become errors.
const asErrors = rules =>
    Object.fromEntries(
        Object.entries(rules).map(([name, value]) => {
            const [severity, ...options] = Array.isArray(value) ? value : [value];
            const level = severity === 'warn' || severity === 1 ? 'error' : severity;

            return [name, options.length > 0 ? [level, ...options] : level];
        }),
    );

/** React hooks (v7 recommended) and the i18n JSX text rule. */
export const reactConfig = () => [
    {
        files: [LINT_FILES],
        plugins: {
            react,
            'react-hooks': reactHooks,
        },
        rules: {
            ...asErrors(reactHooks.configs.recommended.rules),
            // User-facing text in JSX goes through i18n.
            'react/jsx-no-literals': [
                'error',
                {
                    noStrings: true,
                    ignoreProps: true,
                    allowedStrings: [' ', '-', '+', '/', '~'],
                },
            ],
        },
    },
];
