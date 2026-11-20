import { isUiAffecting } from './ui-paths.mjs';

const AUTH_041_URL =
    'https://github.com/ChipIn-one/chipin-knowledge-base/blob/681d392140f33d4a47e3059eb53f77a2ee2c72c8/common/specs/auth.md';
const AUTH_041_STEP = 'Log out, then reload a protected page in the same browser';
const AUTH_041_EXPECTED = 'No restored browser session; the protected page requires a fresh login';

// Scope-specific regression checks. Add a rule only with a pinned canonical behavior source.
export const IMPACT_RULES = [
    {
        id: 'AUTH-041',
        paths: new Set([
            'apps/app/src/store/authStore.ts',
            'apps/app/src/helpers/authSession.ts',
            'apps/app/src/app/router/AuthLayout.tsx',
            'apps/app/src/app/auth/requireSession.ts',
        ]),
        sourceUrl: AUTH_041_URL,
        step: AUTH_041_STEP,
        expected: AUTH_041_EXPECTED,
    },
];

// SMOKE-SHORT: owner decision of 2026-10-28 in ChipIn-one/chipin-frontend#543. One short regression
// round when the compare touches routing, auth/session, API, store bootstrap, service worker/PWA,
// theme switching or Vercel routing. It holds AUTH-041, so AUTH-041 is never added twice. Checks with
// `automated` are covered by the Playwright suite (docs/e2e-tests.md) on the release browser matrix:
// the QA Issue marks them as automated when the matrix passed on every profile, and gives them back
// to the tester otherwise. The other checks need a real Google account or a real phone.
export const SMOKE_SHORT = {
    id: 'SMOKE-SHORT',
    sourceUrl: 'https://github.com/ChipIn-one/chipin-frontend/issues/543',
    prefixes: [
        'apps/app/src/features/routing/', // public locale route and guard loader
        'apps/app/src/app/router/', // route tree, protected routes and their layouts
        'apps/app/src/app/auth/', // session gate: requireSession, sessionAccess
        'apps/app/src/public-routes/', // public route tree and prerendered entry
        'apps/app/src/api/', // API client, interceptors and resources
        'apps/app/src/bootstrap/', // API and Sentry bootstrap
        'apps/app/src/app/pwa/', // service worker registration and update policy
    ],
    files: new Set([
        // routing
        'apps/app/src/constants/routes.ts',
        'apps/app/src/constants/publicRoutes.ts',
        'apps/app/src/constants/publicRouteManifest.ts',
        'apps/app/src/helpers/publicRoutes.ts',
        'apps/app/scripts/private-spa-navigation.ts',
        // auth/session
        'apps/app/src/store/authStore.ts',
        'apps/app/src/store/authSelectors.ts',
        'apps/app/src/store/authConstants.ts',
        'apps/app/src/helpers/authSession.ts',
        'apps/app/src/constants/auth.ts',
        'apps/app/src/hooks/useCheckSignIn.tsx',
        // store bootstrap
        'apps/app/src/root.tsx',
        'apps/app/src/main.tsx',
        'apps/app/src/app/providers/QueryProvider.tsx',
        'apps/app/src/shared/api/queryClient.ts',
        'apps/app/src/pages/GlobalHooks.tsx',
        'apps/app/src/hooks/useSyncUserSettings.tsx',
        // service worker / PWA
        'apps/app/src/helpers/pwa.ts',
        'apps/app/src/helpers/appUpdate.ts',
        'apps/app/src/helpers/serviceWorkerHost.ts',
        'apps/app/public/sw-kill.js',
        'apps/app/scripts/sw-app-plugin.ts',
        'apps/app/src/hooks/pwaHooks.tsx',
        'apps/app/vite.config.ts',
        'apps/app/pwa.config.ts',
        'apps/app/pwa-assets.config.ts',
        'apps/app/scripts/prerender-before-workbox.mjs',
        'apps/app/app.html',
        // theme switching
        'apps/app/src/helpers/theme.ts',
        'apps/app/src/constants/styled-themes.ts',
        'apps/app/src/constants/localstorage.ts',
        // Vercel routing and headers
        'apps/app/vercel.json',
    ]),
    checks: [
        { step: 'Google sign-in on the Preview', expected: 'Dashboard opens' },
        {
            step: 'Create a group expense split equally',
            expected: 'The expense is listed and the balance changed',
            automated: true,
        },
        {
            step: 'Open Balances / Settle up as the other participant',
            expected: 'The matching balance is shown',
            automated: true,
        },
        {
            step: 'Switch language and theme, then reload',
            expected: 'Both apply without a flash and survive the reload',
            automated: true,
        },
        {
            step: AUTH_041_STEP,
            expected: AUTH_041_EXPECTED,
            source: 'AUTH-041',
            sourceUrl: AUTH_041_URL,
            automated: true,
        },
        {
            step: 'On a real phone: type into the expense form, then open the Preview installed to the home screen',
            expected:
                'The keyboard does not cover the field, nothing sits under the notch or the home bar, the installed app starts, and new screens look right',
        },
    ],
};

export function touchesSmokePath(files) {
    for (const file of files) {
        if (!isUiAffecting(file)) continue;
        if (
            SMOKE_SHORT.files.has(file) ||
            SMOKE_SHORT.prefixes.some(prefix => file.startsWith(prefix))
        )
            return true;
    }
    return false;
}

export function smokeChecks() {
    return SMOKE_SHORT.checks.map(check => ({
        smoke: true,
        source: SMOKE_SHORT.id,
        sourceUrl: SMOKE_SHORT.sourceUrl,
        ...check,
    }));
}

export function impactChecks(files, issueNumber) {
    const matches = [];
    for (const rule of IMPACT_RULES) {
        if (files.some(file => rule.paths.has(file))) {
            matches.push({
                issue: issueNumber,
                source: rule.id,
                sourceUrl: rule.sourceUrl,
                step: rule.step,
                expected: rule.expected,
            });
        }
    }
    return matches;
}
