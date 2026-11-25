import { describe, expect, test } from 'vitest';
import {
    assertConfiguration,
    buildChecklist,
    buildIssueBody,
    commitUrl,
    currentQaLogins,
    findQaIssue,
    formatInvalidationLine,
    formatMatrixLine,
    formatResultLine,
    hasGreenFrontendCiRun,
    isNearMissResult,
    MATRIX_PROFILES,
    parseMatrixResult,
    parseQaResult,
    prQaSteps,
    renderMatrixChecks,
    resultOutcome,
    slackLink,
    summarizeMatrix,
    validateDeployment,
    verifyCi,
} from './core.mjs';
import { impactChecks } from './impact-rules.mjs';

const SHA = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const HEAD = 'c'.repeat(40);
const preview = {
    id: 42,
    sha: SHA,
    environment: 'Preview',
    creator: { login: 'vercel[bot]' },
    ref: SHA,
};
const status = {
    state: 'success',
    environment_url: 'https://chipin-frontend-abc-sylliks-projects.vercel.app',
    target_url: 'https://chipin-frontend-abc-sylliks-projects.vercel.app',
};

describe('release evidence', () => {
    test('accepts the selected immutable READY Preview and rejects mismatched or moving URLs', () => {
        expect(validateDeployment(preview, status, 'Preview', SHA).url).toBe(
            status.environment_url,
        );
        expect(() => validateDeployment({ ...preview, sha: BASE }, status, 'Preview', SHA)).toThrow(
            /SHA/,
        );
        expect(() =>
            validateDeployment(
                preview,
                { ...status, environment_url: 'https://dev.chipin.one' },
                'Preview',
                SHA,
            ),
        ).toThrow(/immutable/);
        expect(() =>
            validateDeployment(preview, { ...status, state: 'pending' }, 'Preview', SHA),
        ).toThrow(/success/);
        expect(() =>
            validateDeployment(
                { ...preview, creator: { login: 'syllik' } },
                status,
                'Preview',
                SHA,
            ),
        ).toThrow(/vercel/);
    });

    test('unique deployment host passes and git or master aliases throw', () => {
        const unique = 'https://chipin-frontend-lzaemftpe-sylliks-projects.vercel.app';
        expect(
            validateDeployment(preview, { ...status, environment_url: unique }, 'Preview', SHA).url,
        ).toBe(unique);
        expect(() =>
            validateDeployment(
                preview,
                {
                    ...status,
                    environment_url:
                        'https://chipin-frontend-git-master-sylliks-projects.vercel.app',
                },
                'Preview',
                SHA,
            ),
        ).toThrow(/alias/);
        expect(() =>
            validateDeployment(
                preview,
                {
                    ...status,
                    environment_url: 'https://chipin-frontend-master-sylliks-projects.vercel.app',
                },
                'Preview',
                SHA,
            ),
        ).toThrow(/alias/);
        expect(() =>
            validateDeployment(
                preview,
                {
                    ...status,
                    environment_url: 'https://chipin-frontend-sylliks-projects.vercel.app',
                },
                'Preview',
                SHA,
            ),
        ).toThrow(/alias/);
        expect(() =>
            validateDeployment(
                preview,
                { ...status, environment_url: 'https://dev.chipin.one' },
                'Preview',
                SHA,
            ),
        ).toThrow(/alias/);
    });

    test('accepts the app deployments under their per-project names and refuses the site project', () => {
        const production = { state: 'success', environment_url: 'https://chipin.one' };
        expect(
            validateDeployment(
                { ...preview, environment: 'Production \u2013 chipin-frontend' },
                production,
                'Production',
            ).sha,
        ).toBe(SHA);
        expect(
            validateDeployment(
                { ...preview, environment: 'Preview \u2013 chipin-frontend' },
                status,
                'Preview',
                SHA,
            ).sha,
        ).toBe(SHA);
        expect(() =>
            validateDeployment(
                { ...preview, environment: 'Production \u2013 chipin-site' },
                production,
                'Production',
            ),
        ).toThrow('A trusted vercel[bot] Production deployment is required.');
        expect(() =>
            validateDeployment(
                { ...preview, environment: 'Preview \u2013 chipin-site' },
                status,
                'Preview',
                SHA,
            ),
        ).toThrow('A trusted vercel[bot] Preview deployment is required.');
        expect(() =>
            validateDeployment({ ...preview, environment: 'Preview' }, status, 'Production', SHA),
        ).toThrow('A trusted vercel[bot] Production deployment is required.');
    });

    test('accepts verified Production deployment at the production domain as baseline evidence', () => {
        expect(
            validateDeployment(
                { ...preview, environment: 'Production' },
                { state: 'success', environment_url: 'https://chipin.one' },
                'Production',
            ).sha,
        ).toBe(SHA);
    });

    test('requires exact-SHA successful required CI from trusted app and push run', () => {
        const rule = {
            required_status_checks: [{ context: 'frontend-ci', integration_id: 15368 }],
        };
        const checks = [
            {
                name: 'frontend-ci',
                head_sha: SHA,
                conclusion: 'success',
                status: 'completed',
                app: { id: 15368, slug: 'github-actions' },
            },
        ];
        const runs = [
            {
                head_sha: SHA,
                head_branch: 'master',
                conclusion: 'success',
                status: 'completed',
                event: 'push',
                path: '.github/workflows/frontend-ci.yml',
            },
        ];
        expect(verifyCi(rule, checks, runs, SHA)).toBe(true);
        expect(() => verifyCi(rule, [{ ...checks[0], head_sha: BASE }], runs, SHA)).toThrow(
            /exact SHA/,
        );
        expect(() => verifyCi(rule, checks, [{ ...runs[0], conclusion: 'failure' }], SHA)).toThrow(
            /workflow/,
        );
        expect(() =>
            verifyCi(
                rule,
                checks,
                [{ ...runs[0], head_branch: 'chore/issue-438-release-qa' }],
                SHA,
            ),
        ).toThrow(/workflow/);
        expect(() => verifyCi({ required_status_checks: [] }, checks, runs, SHA)).toThrow(/policy/);
    });

    test('requires every active context at exact SHA and rejects stale earlier success', () => {
        const rule = {
            required_status_checks: [
                { context: 'frontend-ci', integration_id: 15368 },
                { context: 'security-scan', integration_id: 88 },
            ],
        };
        const frontend = {
            id: 10,
            name: 'frontend-ci',
            head_sha: SHA,
            conclusion: 'success',
            status: 'completed',
            app: { id: 15368, slug: 'github-actions' },
        };
        const scan = {
            id: 11,
            name: 'security-scan',
            head_sha: SHA,
            conclusion: 'success',
            status: 'completed',
            app: { id: 88, slug: 'scanner' },
        };
        const runs = [
            {
                head_sha: SHA,
                head_branch: 'master',
                conclusion: 'success',
                status: 'completed',
                event: 'push',
                path: '.github/workflows/frontend-ci.yml',
            },
        ];
        expect(verifyCi(rule, [frontend, scan], runs, SHA)).toBe(true);
        expect(() => verifyCi(rule, [frontend], runs, SHA)).toThrow(/security-scan/);
        expect(() =>
            verifyCi(rule, [frontend, { ...scan, conclusion: 'failure' }], runs, SHA),
        ).toThrow(/security-scan/);
        expect(() =>
            verifyCi(rule, [frontend, { ...scan, app: { id: 99, slug: 'other' } }], runs, SHA),
        ).toThrow(/security-scan/);
        expect(() =>
            verifyCi(rule, [frontend, scan, { ...scan, id: 12, conclusion: 'failure' }], runs, SHA),
        ).toThrow(/security-scan/);
        expect(() =>
            verifyCi(
                rule,
                [frontend, scan],
                [
                    { ...runs[0], id: 20 },
                    { ...runs[0], id: 21, conclusion: 'failure' },
                ],
                SHA,
            ),
        ).toThrow(/workflow/);
    });

    test('required commit-status context uses newest exact-SHA status when no integration ID is specified', () => {
        const rule = {
            required_status_checks: [
                { context: 'frontend-ci', integration_id: 15368 },
                { context: 'external-policy', integration_id: null },
            ],
        };
        const frontend = {
            id: 10,
            name: 'frontend-ci',
            head_sha: SHA,
            conclusion: 'success',
            status: 'completed',
            app: { id: 15368, slug: 'github-actions' },
        };
        const runs = [
            {
                head_sha: SHA,
                head_branch: 'master',
                conclusion: 'success',
                status: 'completed',
                event: 'push',
                path: '.github/workflows/frontend-ci.yml',
            },
        ];
        const status = { id: 40, context: 'external-policy', sha: SHA, state: 'success' };
        expect(verifyCi(rule, [frontend], runs, SHA, [status])).toBe(true);
        expect(() =>
            verifyCi(rule, [frontend], runs, SHA, [
                status,
                { ...status, id: 41, state: 'failure' },
            ]),
        ).toThrow(/external-policy/);
    });
});

describe('green frontend-ci push run', () => {
    const run = {
        id: 1,
        head_sha: SHA,
        head_branch: 'master',
        conclusion: 'success',
        status: 'completed',
        event: 'push',
        path: '.github/workflows/frontend-ci.yml',
    };

    test('needs the newest master push run for the exact SHA to be successful', () => {
        expect(hasGreenFrontendCiRun([run], SHA)).toBe(true);
        expect(hasGreenFrontendCiRun([], SHA)).toBe(false);
        expect(
            hasGreenFrontendCiRun([{ ...run, status: 'in_progress', conclusion: null }], SHA),
        ).toBe(false);
        expect(hasGreenFrontendCiRun([run, { ...run, id: 2, conclusion: 'failure' }], SHA)).toBe(
            false,
        );
        expect(hasGreenFrontendCiRun([{ ...run, head_sha: BASE }], SHA)).toBe(false);
        expect(hasGreenFrontendCiRun([{ ...run, event: 'pull_request' }], SHA)).toBe(false);
    });
});

describe('scope and canonical QA identity', () => {
    const issue = {
        number: 12,
        html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/12',
        body: '## Acceptance\n- [ ] QA: Open settings => Settings page appears\n',
    };
    const pull = {
        number: 20,
        html_url: 'https://github.com/ChipIn-one/chipin-frontend/pull/20',
        issues: [12],
        commits: [SHA, BASE],
        files: ['apps/app/src/App.tsx'],
    };
    const primary = { issue: 12, step: 'Open settings', expected: 'Settings page appears' };

    test('deduplicates a multi-commit PR and derives only explicit steps and expected results', () => {
        const plan = buildChecklist({
            files: ['apps/app/src/App.tsx'],
            commits: [SHA, BASE],
            pulls: [pull],
            issues: [issue],
        });
        expect(plan.kind).toBe('checks');
        expect(plan.checks).toEqual([primary]);
        expect(plan.included).toEqual([{ issue: 12, pulls: [20] }]);
        expect(plan.missingSteps).toEqual([]);
        expect(plan.smoke).toBe(false);
    });

    test('a compare with only CI, workflow, test or docs files needs no manual QA, even with unlinked commits', () => {
        const files = [
            '.github/workflows/frontend-ci.yml',
            'scripts/release-qa/core.mjs',
            'apps/app/src/App.test.tsx',
            'docs/help.md',
        ];
        const result = buildChecklist({
            files,
            commits: [SHA, BASE],
            pulls: [
                {
                    ...pull,
                    commits: [SHA],
                    files: ['.github/workflows/frontend-ci.yml', 'apps/app/src/App.test.tsx'],
                },
            ],
            issues: [issue],
            commitFiles: { [BASE]: ['docs/help.md', 'scripts/release-qa/core.mjs'] },
        });
        expect(result).toMatchObject({
            kind: 'none',
            reason: 'NO_MANUAL_QA_REQUIRED',
            evidence: files,
            included: [{ issue: 12, pulls: [20] }],
            noQa: [{ commit: BASE }],
        });
    });

    test('an included UI Issue without QA lines gets the check-against-Acceptance line instead of blocking', () => {
        const result = buildChecklist({
            files: ['apps/app/src/App.tsx'],
            commits: [SHA],
            pulls: [{ ...pull, commits: [SHA] }],
            issues: [{ ...issue, body: '## Acceptance\n- [ ] Works' }],
        });
        expect(result.kind).toBe('checks');
        expect(result.checks).toEqual([
            {
                issue: 12,
                step: 'check against the Acceptance of #12',
                expected: issue.html_url,
                missing: true,
            },
        ]);
        expect(result.missingSteps).toEqual([12]);
    });

    test('an unlinked Dependabot commit that changes only package files or workflows does not block', () => {
        const dependabot = {
            number: 30,
            issues: [],
            commits: [BASE],
            files: ['package.json', 'package-lock.json', '.github/workflows/frontend-ci.yml'],
        };
        const result = buildChecklist({
            files: [
                'apps/app/src/App.tsx',
                'package.json',
                'package-lock.json',
                '.github/workflows/frontend-ci.yml',
            ],
            commits: [SHA, BASE],
            pulls: [{ ...pull, commits: [SHA] }, dependabot],
            issues: [issue],
        });
        expect(result.checks).toEqual([primary]);
        expect(result.noQa).toEqual([{ pull: 30, commits: [BASE] }]);
        expect(result.included).toEqual([{ issue: 12, pulls: [20] }]);
    });

    test('an unlinked commit or PR under src/ still blocks', () => {
        expect(() =>
            buildChecklist({
                files: ['apps/app/src/App.tsx'],
                commits: [SHA],
                pulls: [],
                issues: [],
                commitFiles: { [SHA]: ['apps/app/src/App.tsx'] },
            }),
        ).toThrow(/unlinked commit.*UI-affecting/);
        expect(() =>
            buildChecklist({
                files: ['apps/app/src/App.tsx'],
                commits: [SHA],
                pulls: [],
                issues: [],
            }),
        ).toThrow(/unlinked commit/);
        expect(() =>
            buildChecklist({
                files: ['apps/app/src/App.tsx'],
                commits: [SHA],
                pulls: [{ ...pull, commits: [SHA], issues: [] }],
                issues: [],
            }),
        ).toThrow(/PR #20.*UI-affecting/);
        expect(() =>
            buildChecklist({
                files: ['apps/app/src/App.tsx'],
                commits: [SHA],
                pulls: [{ ...pull, commits: [SHA], issues: [12, 13] }],
                issues: [issue],
            }),
        ).toThrow(/PR #20.*UI-affecting/);
    });

    test('a linked PR without readable files fails closed', () => {
        expect(() =>
            buildChecklist({
                files: ['apps/app/src/App.tsx'],
                commits: [SHA],
                pulls: [{ ...pull, commits: [SHA], files: undefined }],
                issues: [issue],
            }),
        ).toThrow(/files/);
    });

    test('mixed candidate omits manual checks for a linked non-UI PR', () => {
        const docsPull = { number: 21, issues: [13], commits: [BASE], files: ['docs/help.md'] };
        const result = buildChecklist({
            files: ['apps/app/src/App.tsx', 'docs/help.md'],
            commits: [SHA, BASE],
            pulls: [{ ...pull, commits: [SHA] }, docsPull],
            issues: [issue, { number: 13, body: '## Acceptance\n- [ ] Documentation updated' }],
        });
        expect(result.checks).toEqual([primary]);
        expect(result.missingSteps).toEqual([]);
        expect(result.included).toEqual([
            { issue: 12, pulls: [20] },
            { issue: 13, pulls: [21] },
        ]);
    });

    test('uses an explicit when/then acceptance criterion without guessing a scenario', () => {
        const result = buildChecklist({
            files: ['apps/app/src/App.tsx'],
            commits: [SHA],
            pulls: [{ ...pull, commits: [SHA] }],
            issues: [
                {
                    ...issue,
                    body: '## Acceptance\n- [ ] When a member opens settings, then the settings page appears',
                },
            ],
        });
        expect(result.checks).toEqual([
            { issue: 12, step: 'a member opens settings', expected: 'the settings page appears' },
        ]);
    });

    test('a risky path appends the six SMOKE-SHORT checks once and AUTH-041 is not duplicated', () => {
        const result = buildChecklist({
            files: [
                'apps/app/src/store/authStore.ts',
                'apps/app/src/helpers/authSession.ts',
                'apps/app/src/api/groupsApi.ts',
            ],
            commits: [SHA, BASE],
            pulls: [
                {
                    ...pull,
                    commits: [SHA],
                    files: [
                        'apps/app/src/store/authStore.ts',
                        'apps/app/src/helpers/authSession.ts',
                    ],
                },
                {
                    number: 21,
                    issues: [12],
                    commits: [BASE],
                    files: ['apps/app/src/api/groupsApi.ts'],
                },
            ],
            issues: [issue],
        });
        expect(result.smoke).toBe(true);
        expect(result.checks[0]).toEqual(primary);
        const smoke = result.checks.filter(item => item.smoke);
        expect(smoke).toHaveLength(6);
        expect(result.checks).toHaveLength(7);
        expect(smoke.map(item => item.step).join('\n')).toMatch(
            /Google sign-in[\s\S]*split equally[\s\S]*other participant[\s\S]*language and theme[\s\S]*Log out[\s\S]*real phone/,
        );
        // Google sign-in and the real phone stay manual; the Playwright suite covers the rest.
        expect(smoke.map(item => Boolean(item.automated))).toEqual([
            false,
            true,
            true,
            true,
            true,
            false,
        ]);
        const auth = result.checks.filter(item => item.source === 'AUTH-041');
        expect(auth).toHaveLength(1);
        expect(auth[0]).toMatchObject({
            smoke: true,
            sourceUrl:
                'https://github.com/ChipIn-one/chipin-knowledge-base/blob/681d392140f33d4a47e3059eb53f77a2ee2c72c8/common/specs/auth.md',
        });
        expect(auth[0].expected).toMatch(/no restored browser session/i);
        expect(auth[0].expected).not.toMatch(/access.token.*revok/i);
    });

    test('the protected-route gate (AuthLayout, requireSession) triggers AUTH-041', () => {
        for (const file of [
            'apps/app/src/app/router/AuthLayout.tsx',
            'apps/app/src/app/auth/requireSession.ts',
        ]) {
            expect(
                impactChecks([file], 12).map(check => check.source),
                file,
            ).toEqual(['AUTH-041']);
        }
    });

    test('routing, bootstrap, service worker, theme and vercel.json trigger SMOKE-SHORT; tests and plain UI do not', () => {
        for (const file of [
            'apps/app/src/app/router/createAppRouter.tsx',
            'apps/app/src/app/auth/requireSession.ts',
            'apps/app/src/features/routing/PublicLocaleRoute.tsx',
            'apps/app/src/root.tsx',
            'apps/app/src/bootstrap/initializeApi.ts',
            'apps/app/src/app/pwa/ServiceWorkerManager.tsx',
            'apps/app/src/helpers/theme.ts',
            'apps/app/vercel.json',
            'apps/app/vite.config.ts',
            'apps/app/pwa.config.ts',
        ]) {
            const result = buildChecklist({
                files: [file],
                commits: [SHA],
                pulls: [{ ...pull, commits: [SHA], files: [file] }],
                issues: [issue],
            });
            expect(result.smoke, file).toBe(true);
        }
        const plain = buildChecklist({
            files: ['apps/app/src/App.tsx', 'apps/app/src/api/groupsApi.test.ts'],
            commits: [SHA],
            pulls: [
                {
                    ...pull,
                    commits: [SHA],
                    files: ['apps/app/src/App.tsx', 'apps/app/src/api/groupsApi.test.ts'],
                },
            ],
            issues: [issue],
        });
        expect(plain.smoke).toBe(false);
        expect(plain.checks).toEqual([primary]);
    });

    test('a dependencies-only bump from an unlinked commit is build-affecting: QA Issue with SMOKE-SHORT once, no block', () => {
        const files = ['package.json', 'package-lock.json'];
        const result = buildChecklist({
            files,
            commits: [SHA],
            pulls: [],
            issues: [],
            commitFiles: { [SHA]: files },
            buildChanges: ['package.json dependencies: i18next', 'package-lock.json: i18next'],
        });
        expect(result).toMatchObject({
            kind: 'checks',
            smoke: true,
            noQa: [{ commit: SHA }],
            included: [],
            buildAffecting: ['package.json dependencies: i18next', 'package-lock.json: i18next'],
        });
        expect(result.checks).toHaveLength(6);
        expect(result.checks.every(item => item.smoke)).toBe(true);
        const body = buildIssueBody({
            sha: SHA,
            baselineSha: BASE,
            deploymentId: 42,
            url: status.environment_url,
            plan: result,
        });
        expect(body).toContain(
            '### Build-affecting changes\n- package.json dependencies: i18next\n- package-lock.json: i18next',
        );
        expect(body.match(/- \[ \] SMOKE-SHORT: /g) ?? []).toHaveLength(6);
    });

    test('a lint/test devDependency bump with no build change stays NO_MANUAL_QA_REQUIRED', () => {
        const files = ['package.json', 'package-lock.json'];
        expect(
            buildChecklist({
                files,
                commits: [SHA],
                pulls: [],
                issues: [],
                commitFiles: { [SHA]: files },
                buildChanges: [],
            }),
        ).toMatchObject({ kind: 'none', reason: 'NO_MANUAL_QA_REQUIRED' });
    });

    test('tsconfig.app.json and scripts/version-resolver.mjs are build-affecting by path', () => {
        for (const file of ['apps/app/tsconfig.app.json', 'scripts/version-resolver.mjs']) {
            const result = buildChecklist({
                files: [file],
                commits: [SHA],
                pulls: [],
                issues: [],
                commitFiles: { [SHA]: [file] },
            });
            expect(result, file).toMatchObject({
                kind: 'checks',
                smoke: true,
                buildAffecting: [file],
            });
        }
    });

    test('a build-affecting change forces SMOKE-SHORT next to plain UI work, once, without AUTH-041 duplicates', () => {
        const result = buildChecklist({
            files: ['apps/app/src/App.tsx', 'apps/app/tsconfig.app.json'],
            commits: [SHA, BASE],
            pulls: [{ ...pull, commits: [SHA] }],
            issues: [issue],
            commitFiles: { [BASE]: ['apps/app/tsconfig.app.json'] },
        });
        expect(result.smoke).toBe(true);
        expect(result.checks[0]).toEqual(primary);
        expect(result.checks.filter(item => item.smoke)).toHaveLength(6);
        expect(result.checks.filter(item => item.source === 'AUTH-041')).toHaveLength(1);
    });

    test('the QA Issue renders primary, missing-steps and smoke lines with => separators', () => {
        const plan = buildChecklist({
            files: ['apps/app/src/App.tsx', 'apps/app/vercel.json'],
            commits: [SHA, BASE],
            pulls: [
                { ...pull, commits: [SHA] },
                { number: 21, issues: [13], commits: [BASE], files: ['apps/app/vercel.json'] },
            ],
            issues: [
                issue,
                {
                    number: 13,
                    html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/13',
                    body: 'No QA lines',
                },
            ],
        });
        const body = buildIssueBody({
            sha: SHA,
            baselineSha: BASE,
            deploymentId: 42,
            url: status.environment_url,
            plan,
        });
        expect(body).toContain('- [ ] #12: Open settings => Settings page appears\n');
        expect(body).toContain(
            '- [ ] #13: check against the Acceptance of #13 => https://github.com/ChipIn-one/chipin-frontend/issues/13\n',
        );
        expect(body.match(/- \[ \] SMOKE-SHORT: /g) ?? []).toHaveLength(6);
        expect(body).toMatch(/QA PASS/);
    });

    test('PR QA steps come from the QA section and from QA: lines, never from other sections or code blocks', () => {
        const body = [
            '## Summary',
            '- [ ] Not a QA step',
            '- [ ] QA: Open the landing => Stats load',
            '## QA (owner)',
            '- [ ] Create an expense 1000 JPY split among 3 → each share 333.',
            '- [x] QA: Reload the app => No flash',
            '* Plain bullet step',
            '### Offline',
            '- [ ] Go offline: the banner appears',
            '```',
            '- [ ] inside a code block',
            '```',
            '- [ ] Create an expense 1000 JPY split among 3 → each share 333.',
            '- None',
            '## Tests',
            '- [ ] npm run verify:full',
        ].join('\n');
        expect(prQaSteps(body)).toEqual([
            { step: 'Open the landing', expected: 'Stats load' },
            { step: 'Create an expense 1000 JPY split among 3 → each share 333.' },
            { step: 'Reload the app', expected: 'No flash' },
            { step: 'Plain bullet step' },
            { step: 'Go offline: the banner appears' },
        ]);
        expect(prQaSteps('## QA\n- n/a (CI only)\n')).toEqual([]);
        expect(prQaSteps(undefined)).toEqual([]);
    });

    test('PR text cannot fake the QA marker, render HTML or mention anyone, and is bounded', () => {
        const marker = `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=1 -->`;
        const steps = prQaSteps(
            `## QA\n- [ ] ${marker} ping @syllik <img src=x> => ok\n- [ ] ${'x'.repeat(400)}\n${Array.from({ length: 30 }, (_, i) => `- [ ] step ${i}`).join('\n')}`,
        );
        expect(steps[0].step).not.toMatch(/[<>]/);
        expect(steps[0].step).toContain('@\u200bsyllik');
        expect(steps[0].expected).toBe('ok');
        expect(steps[1].step).toHaveLength(300);
        expect(steps).toHaveLength(20);
    });

    test('PR QA parsing skips unfilled items, HTML comments and matched code fences', () => {
        expect(prQaSteps('## QA (owner)\r\n- [ ]\r\n- [ ] \r\n- [ ] QA:\r\n')).toEqual([]);
        expect(prQaSteps('## QA\n<!--\n- hidden example\n-->\n<!-- one line -->\n- real')).toEqual([
            { step: 'real' },
        ]);
        expect(
            prQaSteps(
                '## QA\n````\n```\n- in a four-backtick fence\n```\n````\n```\n~~~\n- in a fence\n```\n- after the fences',
            ),
        ).toEqual([{ step: 'after the fences' }]);
    });

    test('PR QA parsing finds fences nested in list items, ignores inline code spans and stops at an unclosed fence', () => {
        expect(
            prQaSteps(
                '## QA\n- a\n  - b\n    ```bash\n    npm run x\n    - fake\n    ```\n- c\n- - -\n',
            ),
        ).toEqual([{ step: 'a; b' }, { step: 'c' }]);
        expect(prQaSteps('## QA\n- a\n  ```npm run x``` then check\n- b')).toEqual([
            { step: 'a; ```npm run x``` then check' },
            { step: 'b' },
        ]);
        expect(prQaSteps('## QA\n- a\n```\n- b\n## Other\n- [ ] QA: later => x')).toEqual([
            { step: 'a' },
        ]);
        expect(
            prQaSteps('## QA\n- None, docs only\n- No QA needed: CI\n- None => nothing\n'),
        ).toEqual([]);
    });

    test('PR QA parsing keeps numbered items, joins nested items to their parent and drops only whole None items', () => {
        expect(
            prQaSteps(
                [
                    '## QA',
                    '1. Open Settings',
                    '   - Expected: toggle visible',
                    '2) Switch theme',
                    '   then reload => theme survives',
                    '+ Plus bullet',
                    '- None of the rows overflow at 320px',
                    '- N/A for desktop: check mobile',
                    '- None (CI only)',
                    '- None.',
                ].join('\n'),
            ),
        ).toEqual([
            { step: 'Open Settings; Expected: toggle visible' },
            { step: 'Switch theme; then reload', expected: 'theme survives' },
            { step: 'Plus bullet' },
            { step: 'None of the rows overflow at 320px' },
            { step: 'N/A for desktop: check mobile' },
        ]);
    });

    test('PR text never cross-references Issues and is cut by code point', () => {
        const [ref, emoji] = prQaSteps(
            `## QA\n- see #12 and other/repo#3\n- ${'a'.repeat(299)}😀😀`,
        );
        expect(ref.step).toBe('see #\u200b12 and other/repo#\u200b3');
        expect(Array.from(emoji.step)).toHaveLength(300);
        expect(emoji.step.endsWith('😀')).toBe(true);
    });

    test('PR steps share one size budget; past it each PR gets one pointer to its body', () => {
        const long = Array.from(
            { length: 20 },
            (_, i) => `- ${i} ${'s'.repeat(290)} => ${'e'.repeat(290)}`,
        ).join('\n');
        const pulls = Array.from({ length: 6 }, (_, i) => ({
            ...pull,
            number: 30 + i,
            commits: [String(i)],
            html_url: `https://github.com/ChipIn-one/chipin-frontend/pull/${30 + i}`,
            body: `## QA\n${long}`,
        }));
        const plan = buildChecklist({
            files: ['apps/app/src/App.tsx'],
            commits: pulls.map(item => item.commits[0]),
            pulls,
            issues: [{ ...issue, body: '' }],
        });
        const pointers = plan.checks.filter(item => item.step.startsWith('more QA steps'));
        expect(pointers.map(item => item.pull)).toEqual([33, 34, 35]);
        expect(pointers[0].expected).toBe('https://github.com/ChipIn-one/chipin-frontend/pull/33');
        const body = buildIssueBody({
            sha: SHA,
            baselineSha: BASE,
            deploymentId: 42,
            url: status.environment_url,
            plan,
        });
        expect(body.length).toBeLessThan(65536);
    });

    test('an Issue without QA lines uses the QA steps of its UI PRs, grouped per PR, and skips the Acceptance fallback', () => {
        const epic = {
            number: 12,
            title: 'Money module',
            html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/12',
            body: '## Acceptance\n- [ ] Works',
        };
        const plan = buildChecklist({
            files: ['apps/app/src/App.tsx', 'docs/help.md'],
            commits: [SHA, BASE, HEAD],
            pulls: [
                {
                    ...pull,
                    number: 22,
                    title: 'Money parser @syllik',
                    commits: [SHA],
                    body: '## QA (owner)\n- [ ] Split 1000 JPY among 3 => each share 333\n',
                },
                {
                    ...pull,
                    number: 21,
                    title: 'Balances',
                    commits: [BASE],
                    body: '## QA (owner)\n- [ ] Open Balances: totals match\n',
                },
                {
                    ...pull,
                    number: 23,
                    commits: [HEAD],
                    files: ['docs/help.md'],
                    body: '## QA (owner)\n- [ ] Docs only step\n',
                },
            ],
            issues: [epic],
        });
        expect(plan.missingSteps).toEqual([]);
        expect(plan.checks).toEqual([
            { issue: 12, pull: 21, step: 'Open Balances: totals match' },
            { issue: 12, pull: 22, step: 'Split 1000 JPY among 3', expected: 'each share 333' },
        ]);
        const body = buildIssueBody({
            sha: SHA,
            baselineSha: BASE,
            deploymentId: 42,
            url: status.environment_url,
            plan,
        });
        expect(body).toContain(
            '### Checks (step => expected)\n#### PR #21: Balances (#12)\n- [ ] PR #21: Open Balances: totals match\n\n#### PR #22: Money parser @\u200bsyllik (#12)\n- [ ] PR #22: Split 1000 JPY among 3 => each share 333\n',
        );
        expect(body).not.toContain('Docs only step');
        expect(body).not.toContain('Acceptance of #12');
        expect(body).not.toContain('### Missing QA steps');
    });

    test('Issue QA lines come first under the Issue, then its PR steps; the fallback needs neither', () => {
        const withPr = buildChecklist({
            files: ['apps/app/src/App.tsx'],
            commits: [SHA],
            pulls: [
                {
                    ...pull,
                    commits: [SHA],
                    title: 'Settings',
                    body: '## QA\n- [ ] Toggle theme => Theme applies',
                },
            ],
            issues: [{ ...issue, title: 'Settings page' }],
        });
        expect(withPr.checks).toEqual([
            primary,
            { issue: 12, pull: 20, step: 'Toggle theme', expected: 'Theme applies' },
        ]);
        const body = buildIssueBody({
            sha: SHA,
            baselineSha: BASE,
            deploymentId: 42,
            url: status.environment_url,
            plan: withPr,
        });
        expect(body).toContain(
            '#### #12: Settings page\n- [ ] #12: Open settings => Settings page appears\n\n#### PR #20: Settings (#12)\n',
        );
        const none = buildChecklist({
            files: ['apps/app/src/App.tsx'],
            commits: [SHA],
            pulls: [{ ...pull, commits: [SHA], body: '## Summary\n- [ ] Not QA' }],
            issues: [{ ...issue, body: '## Acceptance\n- [ ] Works' }],
        });
        expect(none.missingSteps).toEqual([12]);
        expect(none.checks).toEqual([expect.objectContaining({ issue: 12, missing: true })]);
        expect(
            buildIssueBody({
                sha: SHA,
                baselineSha: BASE,
                deploymentId: 42,
                url: status.environment_url,
                plan: none,
            }),
        ).toContain(
            '- Neither #12 nor its PRs in this release have QA steps; check it against its Acceptance.',
        );
    });

    test('the QA Issue links the Russian tester guide on master next to the QA result section', () => {
        const body = buildIssueBody({
            sha: SHA,
            baselineSha: BASE,
            deploymentId: 42,
            url: status.environment_url,
            plan: buildChecklist({
                files: ['apps/app/src/App.tsx'],
                commits: [SHA, BASE],
                pulls: [pull],
                issues: [issue],
            }),
        });
        const guide = 'https://github.com/ChipIn-one/chipin-frontend/blob/master/docs/qa/README.md';
        const resultSection = body.slice(
            body.indexOf('### QA result'),
            body.indexOf('### Defects and retest'),
        );
        expect(resultSection).toContain(`Tester guide (Russian): ${guide}`);
        expect(body).toContain(`## References\n- ${guide}\n`);
    });

    test('reuses exact repository/SHA marker but rejects conflicting deployment identity', () => {
        const body = buildIssueBody({
            sha: SHA,
            baselineSha: BASE,
            deploymentId: 42,
            url: status.environment_url,
            plan: buildChecklist({
                files: ['apps/app/src/App.tsx'],
                commits: [SHA, BASE],
                pulls: [pull],
                issues: [issue],
            }),
        });
        expect(body).toContain(
            `chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42`,
        );
        expect(findQaIssue([{ number: 91, body }], SHA, 42, status.environment_url)?.number).toBe(
            91,
        );
        expect(() => findQaIssue([{ number: 91, body }], SHA, 43, status.environment_url)).toThrow(
            /conflicting deployment/,
        );
        expect(findQaIssue([{ number: 91, body }], BASE, 42, status.environment_url)).toBeNull();
        expect(() =>
            findQaIssue(
                [
                    { number: 91, body },
                    { number: 92, body },
                ],
                SHA,
                42,
                status.environment_url,
            ),
        ).toThrow(/duplicate/);
    });
});

describe('authorized QA result', () => {
    const issue = {
        body: `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->`,
        assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }],
    };
    const comment = {
        body: 'QA PASS',
        user: { login: 'SoRawSteak', type: 'User' },
        created_at: '2026-10-23T11:00:00Z',
        updated_at: '2026-10-23T11:00:00Z',
    };

    test('the first non-empty line, trimmed and case-insensitive, is the result; notes may follow', () => {
        expect(resultOutcome('QA PASS')).toBe('PASS');
        expect(resultOutcome(' qa pass ')).toBe('PASS');
        expect(resultOutcome('\n\n  QA FAIL\nLogin button does nothing')).toBe('FAIL');
        expect(resultOutcome('QA Blocked\r\nPreview is down')).toBe('BLOCKED');
        expect(resultOutcome('Looks fine\nQA PASS')).toBeNull();
        expect(resultOutcome('QA PASSED')).toBeNull();
        expect(resultOutcome('QA RESULT: PASS')).toBeNull();
        expect(resultOutcome('')).toBeNull();
        expect(resultOutcome(undefined)).toBeNull();
    });

    test('a first line that starts with qa but is not an allowed result is a near miss', () => {
        for (const body of [
            'QA PASSED',
            '**QA PASS**',
            'QA PASS.',
            '  qa: pass',
            '> QA fail',
            'qa',
        ])
            expect(isNearMissResult(body), body).toBe(true);
        for (const body of [
            'QA PASS',
            ' qa blocked \nnotes',
            'Looks good, QA PASS',
            'Starting now',
            '',
            undefined,
        ])
            expect(isNearMissResult(body), String(body)).toBe(false);
    });

    test('accepts only the sole assigned human QA in a new unedited comment and pins the marker SHA', () => {
        expect(parseQaResult(comment, issue)).toEqual({
            outcome: 'PASS',
            sha: SHA,
            qa: 'SoRawSteak',
        });
        expect(
            parseQaResult({ ...comment, body: ' qa fail \nSettle up is broken' }, issue),
        ).toMatchObject({ outcome: 'FAIL' });
        expect(() =>
            parseQaResult({ ...comment, user: { login: 'syllik', type: 'User' } }, issue),
        ).toThrow(/assigned QA/);
        expect(() =>
            parseQaResult({ ...comment, user: { login: 'someone', type: 'User' } }, issue),
        ).toThrow(/assigned QA/);
        expect(() =>
            parseQaResult({ ...comment, user: { login: 'SoRawSteak', type: 'Bot' } }, issue),
        ).toThrow(/human/);
        expect(() =>
            parseQaResult({ ...comment, updated_at: '2026-10-23T11:01:00Z' }, issue),
        ).toThrow(/edited/);
        expect(() => parseQaResult({ ...comment, body: 'Not done yet' }, issue)).toThrow(/QA PASS/);
        expect(() =>
            parseQaResult(comment, {
                ...issue,
                assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }, { login: 'other' }],
            }),
        ).toThrow(/sole/);
    });

    test('formats one Slack result line with the owner mention or plain login', () => {
        const result = { outcome: 'PASS', sha: SHA, qa: 'SoRawSteak' };
        const issueUrl = 'https://github.com/ChipIn-one/chipin-frontend/issues/50';
        const tail = `QA PASS по <https://github.com/ChipIn-one/chipin-frontend/commit/${SHA}|aaaaaaa> — <${issueUrl}|QA Issue #50> (QA: SoRawSteak)`;
        expect(
            formatResultLine({
                result,
                issueUrl,
                issueNumber: 50,
                userMap: '{"syllik":"U0OWNER123"}',
            }),
        ).toBe(`<@U0OWNER123> ${tail}`);
        expect(formatResultLine({ result, issueUrl, issueNumber: 50, userMap: '{}' })).toBe(
            `syllik ${tail}`,
        );
        expect(
            formatResultLine({ result, issueUrl, issueNumber: 50, userMap: 'not json' }),
        ).toMatch(/^syllik /);
        expect(
            formatResultLine({
                result,
                issueUrl,
                issueNumber: 50,
                userMap: '{"syllik":"<!channel>"}',
            }),
        ).toMatch(/^syllik /);
        expect(
            formatResultLine({
                result: { ...result, outcome: 'BLOCKED' },
                issueUrl,
                issueNumber: 50,
                userMap: '{}',
            }),
        ).toMatch(/^syllik QA BLOCKED по /);
        expect(
            formatResultLine({
                result: { ...result, qa: 'syllik' },
                issueUrl,
                issueNumber: 50,
                userMap: '{}',
            }),
        ).toMatch(/\(QA: syllik\)$/);
        expect(() =>
            formatResultLine({
                result: { ...result, qa: '<!channel>' },
                issueUrl,
                issueNumber: 50,
                userMap: '{}',
            }),
        ).toThrow(/login/);
        expect(formatResultLine({ result, issueUrl, issueNumber: 50, userMap: '{}' })).not.toMatch(
            /(^|[^<])https:\/\//,
        );
    });

    test('formats the withdrawn result line with Slack links only', () => {
        const issueUrl = 'https://github.com/ChipIn-one/chipin-frontend/issues/50';
        expect(
            formatInvalidationLine({
                sha: SHA,
                issueUrl,
                issueNumber: 50,
                userMap: '{"syllik":"U0OWNER123"}',
            }),
        ).toBe(
            `<@U0OWNER123> Результат QA по <https://github.com/ChipIn-one/chipin-frontend/commit/${SHA}|aaaaaaa> отозван — <${issueUrl}|QA Issue #50>`,
        );
        expect(() =>
            formatInvalidationLine({ sha: 'abc', issueUrl, issueNumber: 50, userMap: '{}' }),
        ).toThrow(/40-character/);
    });

    test('Slack links escape & and reject <, > and | in interpolated values', () => {
        expect(commitUrl(SHA)).toBe(`https://github.com/ChipIn-one/chipin-frontend/commit/${SHA}`);
        expect(slackLink('https://example.test/a?b=1&c=2', 'A & B')).toBe(
            '<https://example.test/a?b=1&amp;c=2|A &amp; B>',
        );
        expect(() => slackLink('https://example.test/<x>', 'ok')).toThrow(/Slack link/);
        expect(() => slackLink('https://example.test/a|b', 'ok')).toThrow(/Slack link/);
        expect(() => slackLink('https://example.test/', 'a|b')).toThrow(/Slack link/);
        expect(() => slackLink('https://example.test/', '<@U1>')).toThrow(/Slack link/);
        expect(() => slackLink('javascript:alert(1)', 'ok')).toThrow(/Slack link/);
        expect(() => slackLink('https://example.test/a b', 'ok')).toThrow(/Slack link/);
    });

    test('the owner is the QA only when he is the sole assignee', () => {
        expect(currentQaLogins([{ login: 'syllik' }])).toEqual(['syllik']);
        expect(currentQaLogins([{ login: 'syllik' }, { login: 'SoRawSteak' }])).toEqual([
            'SoRawSteak',
        ]);
        expect(currentQaLogins([{ login: 'SoRawSteak' }])).toEqual(['SoRawSteak']);
        expect(currentQaLogins([])).toEqual([]);
        expect(currentQaLogins(undefined)).toEqual([]);
    });

    test('accepts the owner result only when the owner is the sole assignee', () => {
        const ownerIssue = { ...issue, assignees: [{ login: 'syllik' }] };
        const ownerComment = { ...comment, user: { login: 'syllik', type: 'User' } };
        expect(parseQaResult(ownerComment, ownerIssue)).toEqual({
            outcome: 'PASS',
            sha: SHA,
            qa: 'syllik',
        });
        expect(
            parseQaResult({ ...ownerComment, body: 'QA BLOCKED\nPreview 404' }, ownerIssue),
        ).toMatchObject({ outcome: 'BLOCKED', qa: 'syllik' });
        expect(() => parseQaResult(ownerComment, issue)).toThrow(/assigned QA/);
        expect(() => parseQaResult(comment, ownerIssue)).toThrow(/assigned QA/);
        expect(() =>
            parseQaResult({ ...ownerComment, updated_at: '2026-10-23T11:01:00Z' }, ownerIssue),
        ).toThrow(/edited/);
        expect(() =>
            parseQaResult({ ...ownerComment, user: { login: 'syllik', type: 'Bot' } }, ownerIssue),
        ).toThrow(/human/);
    });

    test('requires write token and an explicit identity map before handoff', () => {
        expect(() =>
            assertConfiguration(
                {
                    CHIPIN_DEV_READ_TOKEN: 'read',
                    SLACK_USER_MAP: '{"SoRawSteak":"U0C9X8T4R2Q"}',
                },
                'SoRawSteak',
            ),
        ).toThrow(/CHIPIN_ISSUE_WRITE_TOKEN/);
        expect(() =>
            assertConfiguration(
                {
                    CHIPIN_DEV_READ_TOKEN: 'read',
                    CHIPIN_ISSUE_WRITE_TOKEN: 'write',
                    SLACK_USER_MAP: '{}',
                },
                'SoRawSteak',
            ),
        ).toThrow(/SLACK_USER_MAP/);
        // The webhook is not part of the script configuration (the Slack step posts the handoff).
        const full = { CHIPIN_DEV_READ_TOKEN: 'read', CHIPIN_ISSUE_WRITE_TOKEN: 'write' };
        expect(
            assertConfiguration(
                { ...full, SLACK_USER_MAP: '{"SoRawSteak":"U0C9X8T4R2Q"}' },
                'SoRawSteak',
            ),
        ).toEqual({ slackId: 'U0C9X8T4R2Q' });
        // The owner as QA gets no mention, so his Slack ID is not required; the map must still be JSON.
        expect(assertConfiguration({ ...full, SLACK_USER_MAP: '{}' }, 'syllik')).toEqual({
            slackId: null,
        });
        expect(() => assertConfiguration({ ...full, SLACK_USER_MAP: 'nope' }, 'syllik')).toThrow(
            /JSON/,
        );
        expect(
            assertConfiguration(
                { ...full, SLACK_WEBHOOK_CI: 'not a webhook', SLACK_USER_MAP: '{}' },
                'syllik',
            ),
        ).toEqual({ slackId: null });
    });
});

describe('release browser matrix', () => {
    const IDS = ['chromium', 'firefox', 'webkit', 'pixel', 'iphone'];
    const result = (profile, overrides = {}) =>
        JSON.stringify({
            version: 1,
            profile,
            status: 'passed',
            passed: 12,
            failed: 0,
            flaky: 0,
            skipped: 0,
            ...overrides,
        });
    const allPassed = () =>
        summarizeMatrix({
            results: Object.fromEntries(IDS.map(id => [id, parseMatrixResult(result(id), id)])),
            conclusions: Object.fromEntries(IDS.map(id => [id, 'success'])),
            runId: 4242,
        });
    const RUN_URL = 'https://github.com/ChipIn-one/chipin-frontend/actions/runs/4242';
    const smokePlan = () =>
        buildChecklist({
            files: ['package.json'],
            commits: [SHA],
            pulls: [],
            issues: [],
            commitFiles: { [SHA]: ['package.json'] },
            buildChanges: ['package.json dependencies: i18next'],
        });
    const body = matrix =>
        buildIssueBody({
            sha: SHA,
            baselineSha: BASE,
            deploymentId: 42,
            url: status.environment_url,
            plan: smokePlan(),
            matrix,
        });

    test('profiles are the five Playwright projects of the release matrix', () => {
        expect(MATRIX_PROFILES.map(profile => profile.id)).toEqual(IDS);
    });

    test('a result file is accepted only in its exact shape, for its own profile', () => {
        expect(parseMatrixResult(result('webkit', { skipped: 1 }), 'webkit')).toEqual({
            status: 'passed',
            passed: 12,
            failed: 0,
            flaky: 0,
            skipped: 1,
        });
        for (const text of [
            '',
            'not json',
            'null',
            '[]',
            result('firefox'),
            result('webkit', { version: 2 }),
            result('webkit', { status: 'PASSED' }),
            result('webkit', { status: 'skipped' }),
            result('webkit', { passed: -1 }),
            result('webkit', { passed: 1.5 }),
            result('webkit', { passed: '12' }),
            result('webkit', { failed: 10001 }),
            result('webkit', { note: '<!-- chipin-release-qa:v1 -->' }),
            JSON.stringify({ version: 1, profile: 'webkit', status: 'passed' }),
        ]) {
            expect(parseMatrixResult(text, 'webkit'), text).toBeNull();
        }
    });

    test('a profile passes only with a green job and a passing result; anything else fails or has no result', () => {
        const results = {
            chromium: parseMatrixResult(result('chromium'), 'chromium'),
            firefox: parseMatrixResult(
                result('firefox', { status: 'failed', passed: 10, failed: 2 }),
                'firefox',
            ),
            // The result file claims a pass, but the job failed (e.g. the purge step).
            webkit: parseMatrixResult(result('webkit'), 'webkit'),
            pixel: parseMatrixResult(result('pixel', { status: 'error', passed: 0 }), 'pixel'),
            iphone: null,
        };
        const matrix = summarizeMatrix({
            results,
            conclusions: {
                chromium: 'success',
                firefox: 'failure',
                webkit: 'failure',
                pixel: 'failure',
                iphone: 'cancelled',
            },
            runId: 4242,
        });
        expect(matrix.runUrl).toBe(RUN_URL);
        expect(matrix.passed).toBe(false);
        expect(matrix.profiles.map(profile => [profile.id, profile.status])).toEqual([
            ['chromium', 'passed'],
            ['firefox', 'failed'],
            ['webkit', 'failed'],
            ['pixel', 'not_run'],
            ['iphone', 'not_run'],
        ]);
        // A claimed pass without a verified job conclusion, or with no test at all, is no pass.
        const unverified = summarizeMatrix({
            results: {
                chromium: parseMatrixResult(result('chromium'), 'chromium'),
                firefox: parseMatrixResult(result('firefox', { passed: 0 }), 'firefox'),
            },
            conclusions: { firefox: 'success' },
            runId: 4242,
        });
        expect(unverified.profiles[0].status).toBe('not_run');
        expect(unverified.profiles[1].status).toBe('not_run');
        expect(() => summarizeMatrix({ runId: Number.NaN })).toThrow(/GITHUB_RUN_ID/);
    });

    test('a passed matrix is stated first in the QA Issue, per profile, and marks SMOKE-SHORT b-e as automated', () => {
        const text = body(allPassed());
        const [marker, ...rest] = text.split('\n');
        expect(marker).toMatch(/^<!-- chipin-release-qa:v1 /);
        expect(rest.slice(0, 2)).toEqual([
            '> [!NOTE]',
            `> The automated browser matrix passed on all 5 profiles ([run](${RUN_URL})). The SMOKE-SHORT checks it covers are marked as automated.`,
        ]);
        expect(text.indexOf('> [!NOTE]')).toBeLessThan(text.indexOf('## Problem'));
        expect(text).toContain(
            [
                '### Automated browser matrix',
                `Playwright smoke and money flows against the immutable Preview URL ([run](${RUN_URL})).`,
                '',
                '| Profile | Result | Passed | Failed | Flaky | Skipped |',
                '| --- | --- | --- | --- | --- | --- |',
                '| Desktop Chromium | passed | 12 | 0 | 0 | 0 |',
                '| Desktop Firefox | passed | 12 | 0 | 0 | 0 |',
                '| Desktop WebKit | passed | 12 | 0 | 0 | 0 |',
                '| Pixel 7 (Chromium) | passed | 12 | 0 | 0 | 0 |',
                '| iPhone 15 (WebKit) | passed | 12 | 0 | 0 | 0 |',
            ].join('\n'),
        );
        // Manual: Google sign-in and the real phone; covered: b-e, after the manual ones.
        expect(text.match(/- \[ \] SMOKE-SHORT: /g) ?? []).toHaveLength(2);
        expect(text).toContain(
            '- [ ] SMOKE-SHORT: Google sign-in on the Preview => Dashboard opens',
        );
        expect(text).toMatch(/- \[ \] SMOKE-SHORT: On a real phone: /);
        expect(text.match(/^- SMOKE-SHORT \(automated\): /gm) ?? []).toHaveLength(4);
        expect(text).toContain(
            '#### SMOKE-SHORT covered by the browser matrix\n- SMOKE-SHORT (automated): Create a group expense split equally',
        );
        expect(text.indexOf('On a real phone')).toBeLessThan(
            text.indexOf('#### SMOKE-SHORT covered by the browser matrix'),
        );
        expect(text).toMatch(/\(automated\): Log out, then reload .*\(\[AUTH-041\]\(/);
    });

    test('a failed or missing matrix is stated at the top and gives SMOKE-SHORT b-e back to the tester', () => {
        const matrix = summarizeMatrix({
            results: {
                chromium: parseMatrixResult(result('chromium'), 'chromium'),
                firefox: parseMatrixResult(
                    result('firefox', { status: 'failed', passed: 11, failed: 1 }),
                    'firefox',
                ),
                webkit: parseMatrixResult(result('webkit', { skipped: 1, passed: 11 }), 'webkit'),
                pixel: parseMatrixResult(result('pixel'), 'pixel'),
            },
            conclusions: {
                chromium: 'success',
                firefox: 'failure',
                webkit: 'success',
                pixel: 'success',
            },
            runId: 4242,
        });
        const text = body(matrix);
        expect(text.split('\n').slice(1, 4)).toEqual([
            '> [!CAUTION]',
            `> **The automated browser matrix did not pass.** Failed: Desktop Firefox. No result: iPhone 15 (WebKit). See the [run](${RUN_URL}).`,
            '> The SMOKE-SHORT checks it covers stay in the manual list.',
        ]);
        expect(text).toContain('| Desktop Firefox | **failed** | 11 | 1 | 0 | 0 |');
        expect(text).toContain('| Desktop WebKit | passed | 11 | 0 | 0 | 1 |');
        expect(text).toContain('| iPhone 15 (WebKit) | **no result** | - | - | - | - |');
        expect(text).not.toContain('(automated)');
        expect(text.match(/- \[ \] SMOKE-SHORT: /g) ?? []).toHaveLength(6);
        expect(
            text.match(/\(the browser matrix did not pass: check by hand\)/g) ?? [],
        ).toHaveLength(4);
        expect(text).toContain(
            '- [ ] SMOKE-SHORT: Google sign-in on the Preview => Dashboard opens\n',
        );
    });

    test('without a matrix the QA Issue is unchanged', () => {
        const text = body(null);
        expect(text).not.toContain('browser matrix');
        expect(text.split('\n')[1]).toBe('## Problem');
        expect(text.match(/- \[ \] SMOKE-SHORT: /g) ?? []).toHaveLength(6);
    });

    test('the Slack matrix line names failed and missing profiles and links the run', () => {
        expect(formatMatrixLine(allPassed())).toBe(
            `Автотесты в браузерах прошли на всех 5 профилях — <${RUN_URL}|Run>`,
        );
        const failed = summarizeMatrix({
            results: { chromium: parseMatrixResult(result('chromium', { failed: 1 }), 'chromium') },
            conclusions: { chromium: 'failure' },
            runId: 4242,
        });
        expect(formatMatrixLine(failed)).toBe(
            `Автотесты в браузерах НЕ прошли (упали: Desktop Chromium; без результата: Desktop Firefox, Desktop WebKit, Pixel 7 (Chromium), iPhone 15 (WebKit)) — <${RUN_URL}|Run>`,
        );
    });

    test('a candidate from before the matrix is stated as such, not as failed or no result', () => {
        const unsupported = id =>
            parseMatrixResult(result(id, { status: 'unsupported', passed: 0 }), id);
        expect(unsupported('firefox')).toMatchObject({ status: 'unsupported' });
        const matrix = summarizeMatrix({
            results: {
                chromium: parseMatrixResult(result('chromium'), 'chromium'),
                firefox: unsupported('firefox'),
                webkit: unsupported('webkit'),
                pixel: unsupported('pixel'),
                iphone: unsupported('iphone'),
            },
            // The unsupported jobs succeed: nothing ran.
            conclusions: Object.fromEntries(IDS.map(id => [id, 'success'])),
            runId: 4242,
        });
        expect(matrix.passed).toBe(false);
        expect(matrix.profiles.map(profile => profile.status)).toEqual([
            'passed',
            'predates',
            'predates',
            'predates',
            'predates',
        ]);
        const text = body(matrix);
        expect(text.split('\n')[2]).toBe(
            `> **The automated browser matrix did not pass.** The candidate predates the browser matrix (its Playwright config has no five-profile matrix): Desktop Firefox, Desktop WebKit, Pixel 7 (Chromium), iPhone 15 (WebKit). See the [run](${RUN_URL}).`,
        );
        expect(text).toContain('| Desktop Firefox | **not in this candidate** | 0 | 0 | 0 | 0 |');
        expect(text).not.toMatch(/Failed:|No result:/);
        expect(formatMatrixLine(matrix)).toBe(
            `Автотесты в браузерах НЕ прошли (кандидат старше этих профилей: Desktop Firefox, Desktop WebKit, Pixel 7 (Chromium), iPhone 15 (WebKit)) — <${RUN_URL}|Run>`,
        );
    });

    test('rerun checks: a failed matrix hands b-e back as boxes, a passed one lists them as covered, none without SMOKE-SHORT', () => {
        const failed = summarizeMatrix({ results: {}, conclusions: {}, runId: 4242 });
        const back = renderMatrixChecks(smokePlan(), failed);
        expect(back.match(/^- \[ \] SMOKE-SHORT: /gm) ?? []).toHaveLength(4);
        expect(back).not.toContain('Google sign-in');
        const covered = renderMatrixChecks(smokePlan(), allPassed());
        expect(covered.match(/^- SMOKE-SHORT \(automated\): /gm) ?? []).toHaveLength(4);
        const plain = buildChecklist({
            files: ['apps/app/src/App.tsx'],
            commits: [SHA],
            pulls: [{ number: 20, issues: [12], commits: [SHA], files: ['apps/app/src/App.tsx'] }],
            issues: [{ number: 12, body: '- [ ] QA: Open settings => Settings page appears' }],
        });
        expect(renderMatrixChecks(plain, failed)).toBe('');
        expect(renderMatrixChecks({ kind: 'none' }, failed)).toBe('');
    });
});
