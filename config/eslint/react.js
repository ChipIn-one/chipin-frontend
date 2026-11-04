import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

import { appGlob, LINT_FILES } from './base.js';

// There is no `warn` level (spec 02 §D0): the hooks preset's warnings become errors.
const asErrors = rules =>
    Object.fromEntries(
        Object.entries(rules).map(([name, value]) => {
            const [severity, ...options] = Array.isArray(value) ? value : [value];
            const level = severity === 'warn' || severity === 1 ? 'error' : severity;

            return [name, options.length > 0 ? [level, ...options] : level];
        }),
    );

// Demo literals of the design-system gallery are not translated (spec 02 §D5 i18n).
const i18nIgnores = appDir => [appGlob(appDir, 'ds-gallery/**')];

/**
 * React hooks (v7 recommended), the six jsx-a11y rules of §D0 and the i18n JSX text rule.
 * The rest of `jsx-a11y/recommended` is class c and stays off (`no-autofocus`: modals).
 */
export const reactConfig = ({ appDir }) => [
    {
        files: [LINT_FILES],
        plugins: {
            react,
            'react-hooks': reactHooks,
            'jsx-a11y': jsxA11y,
        },
        rules: {
            ...asErrors(reactHooks.configs.recommended.rules),
            // docs/engineering/rules/30-ui.md §Accessibility And Semantics and §Images.
            // Meaningful images get a translated `alt`; decorative ones `alt=""`.
            'jsx-a11y/alt-text': 'error',
            // A link has a real `href`; an action is a `<button>`.
            'jsx-a11y/anchor-is-valid': 'error',
            'jsx-a11y/aria-props': 'error',
            'jsx-a11y/aria-role': 'error',
            'jsx-a11y/role-has-required-aria-props': 'error',
            // No clickable `div`/`span`: use `<button>`, a link or a Radix primitive.
            'jsx-a11y/no-static-element-interactions': 'error',
        },
    },
    {
        files: [LINT_FILES],
        ignores: i18nIgnores(appDir),
        rules: {
            // docs/engineering/rules/30-ui.md §i18n: JSX text goes through i18n, `{t('key')}`.
            'react/jsx-no-literals': [
                'error',
                {
                    noStrings: true,
                    ignoreProps: true,
                    noAttributeStrings: false,
                    allowedStrings: [' ', '-', '+', '/', '~', '·'],
                },
            ],
        },
    },
];

/**
 * `no-restricted-syntax` entries (see project.js): user-facing attributes go through i18n.
 * Technical attributes (`variant`, `size`, `type`, …) are not checked (spec 02 §Nuances).
 */
export const reactSyntax = ({ appDir }) => [
    {
        id: 'i18n-attributes',
        selector:
            'JSXAttribute[name.name=/^(aria-label|aria-description|placeholder|title|alt)$/] > Literal[value=/\\w/]',
        // Test-harness markup is not user-facing (same test glob as the type-aware tests override).
        ignores: [...i18nIgnores(appDir), '**/*.test.{ts,tsx}'],
        message:
            "User-facing attribute text goes through i18n: `aria-label={t('...')}` with a key in every locale (docs/engineering/rules/30-ui.md §i18n).",
    },
];
