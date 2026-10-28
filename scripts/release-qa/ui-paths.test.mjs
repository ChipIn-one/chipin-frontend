import { expect, test } from 'vitest';
import { isUiAffecting, uiAffectingFiles } from './ui-paths.mjs';

test('application code, static assets, entry HTML, locales, Vercel, PWA and Vite config are UI-affecting', () => {
    for (const path of [
        'src/App.tsx', 'src/i18n/locales/en/common.json', 'src/helpers/serviceWorkerRecovery.ts',
        'public/favicon.svg', 'index.html', 'app.html', 'vercel.json', 'vite.config.ts', 'pwa-assets.config.ts',
        'scripts/prerender-before-workbox.mjs', 'scripts/private-spa-navigation.ts',
    ]) expect(isUiAffecting(path), path).toBe(true);
});

test('tests, test setup, CI, workflows, tooling, packages and docs are not UI-affecting', () => {
    for (const path of [
        'src/App.test.tsx', 'src/helpers/theme.test.ts', 'src/test/setup.ts', '.github/workflows/frontend-ci.yml',
        '.github/dependabot.yml', 'scripts/release-qa/core.mjs', 'package.json', 'package-lock.json',
        'docs/engineering/release-qa.md', 'README.md', 'AGENTS.md', 'vitest.config.ts', 'eslint.config.js',
    ]) expect(isUiAffecting(path), path).toBe(false);
});

test('uiAffectingFiles keeps only UI-affecting paths in order', () => {
    expect(uiAffectingFiles(['docs/a.md', 'src/App.tsx', 'src/App.test.tsx', 'vercel.json'])).toEqual(['src/App.tsx', 'vercel.json']);
});
