// Scope-specific regression checks. Add a rule only with a pinned canonical behavior source.
export const IMPACT_RULES = [{
    id: 'AUTH-041',
    paths: new Set([
        'src/store/authStore.ts',
        'src/helpers/authSession.ts',
        'src/features/routing/ProtectedRoute.tsx',
    ]),
    sourceUrl: 'https://github.com/ChipIn-one/chipin-knowledge-base/blob/681d392140f33d4a47e3059eb53f77a2ee2c72c8/common/specs/auth.md',
    step: 'Log out, then reload a protected page in the same browser',
    expected: 'No restored browser session; the protected page requires a fresh login',
}];

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
