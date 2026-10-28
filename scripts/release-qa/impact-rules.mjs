import { isUiAffecting } from './ui-paths.mjs';

const AUTH_041_URL = 'https://github.com/ChipIn-one/chipin-knowledge-base/blob/681d392140f33d4a47e3059eb53f77a2ee2c72c8/common/specs/auth.md';
const AUTH_041_STEP = 'Log out, then reload a protected page in the same browser';
const AUTH_041_EXPECTED = 'No restored browser session; the protected page requires a fresh login';

// Scope-specific regression checks. Add a rule only with a pinned canonical behavior source.
export const IMPACT_RULES = [{
    id: 'AUTH-041',
    paths: new Set([
        'src/store/authStore.ts',
        'src/helpers/authSession.ts',
        'src/features/routing/ProtectedRoute.tsx',
    ]),
    sourceUrl: AUTH_041_URL,
    step: AUTH_041_STEP,
    expected: AUTH_041_EXPECTED,
}];

// SMOKE-SHORT: owner decision of 2026-10-28 in ChipIn-one/chipin-frontend#543. One short regression
// round when the compare touches routing, auth/session, API, store bootstrap, service worker/PWA,
// theme switching or Vercel routing. Its last check is AUTH-041, so AUTH-041 is never added twice.
export const SMOKE_SHORT = {
    id: 'SMOKE-SHORT',
    sourceUrl: 'https://github.com/ChipIn-one/chipin-frontend/issues/543',
    prefixes: [
        'src/features/routing/', // routing and protected routes
        'src/public-routes/', // public route tree and prerendered entry
        'src/api/', // API client, interceptors and resources
        'src/bootstrap/', // API and Sentry bootstrap
    ],
    files: new Set([
        // routing
        'src/constants/routes.ts',
        'src/constants/publicRoutes.ts',
        'src/constants/publicRouteManifest.ts',
        'src/helpers/publicRoutes.ts',
        'scripts/private-spa-navigation.ts',
        // auth/session
        'src/store/authStore.ts',
        'src/store/authSelectors.ts',
        'src/store/authConstants.ts',
        'src/helpers/authSession.ts',
        'src/constants/auth.ts',
        'src/hooks/useCheckSignIn.tsx',
        // store bootstrap
        'src/root.tsx',
        'src/main.tsx',
        'src/store/index.ts',
        'src/pages/GlobalHooks.tsx',
        'src/hooks/useSyncUserSettings.tsx',
        // service worker / PWA
        'src/helpers/pwa.ts',
        'src/helpers/serviceWorkerRecovery.ts',
        'src/hooks/pwaHooks.tsx',
        'src/basics/PWABadge.tsx',
        'vite.config.ts',
        'pwa-assets.config.ts',
        'scripts/prerender-before-workbox.mjs',
        'app.html',
        // theme switching
        'src/helpers/theme.ts',
        'src/constants/styled-themes.ts',
        'src/constants/localstorage.ts',
        // Vercel routing and headers
        'vercel.json',
    ]),
    checks: [
        { step: 'Google sign-in on the Preview', expected: 'Dashboard opens' },
        { step: 'Create a group expense split equally', expected: 'The expense is listed and the balance changed' },
        { step: 'Open Balances / Settle up as the other participant', expected: 'The matching balance is shown' },
        { step: 'Switch language and theme, then reload', expected: 'Both apply without a flash and survive the reload' },
        { step: AUTH_041_STEP, expected: AUTH_041_EXPECTED, source: 'AUTH-041', sourceUrl: AUTH_041_URL },
    ],
};

export function touchesSmokePath(files) {
    for (const file of files) {
        if (!isUiAffecting(file)) continue;
        if (SMOKE_SHORT.files.has(file) || SMOKE_SHORT.prefixes.some(prefix => file.startsWith(prefix))) return true;
    }
    return false;
}

export function smokeChecks() {
    return SMOKE_SHORT.checks.map(check => ({ smoke: true, source: SMOKE_SHORT.id, sourceUrl: SMOKE_SHORT.sourceUrl, ...check }));
}

export function impactChecks(files, issueNumber) {
    const matches = [];
    for (const rule of IMPACT_RULES) {
        if (files.some(file => rule.paths.has(file))) {
            matches.push({ issue: issueNumber, source: rule.id, sourceUrl: rule.sourceUrl,
                step: rule.step, expected: rule.expected });
        }
    }
    return matches;
}
