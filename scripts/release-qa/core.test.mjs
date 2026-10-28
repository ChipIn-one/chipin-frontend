import { describe, expect, test } from 'vitest';
import {
    assertConfiguration, buildChecklist, buildIssueBody, findQaIssue, formatResultLine, hasGreenFrontendCiRun,
    isNearMissResult, parseQaResult, resultOutcome, validateDeployment, verifyCi,
} from './core.mjs';

const SHA = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const preview = {
    id: 42, sha: SHA, environment: 'Preview', creator: { login: 'vercel[bot]' },
    ref: SHA,
};
const status = {
    state: 'success', environment_url: 'https://chipin-frontend-abc-sylliks-projects.vercel.app',
    target_url: 'https://chipin-frontend-abc-sylliks-projects.vercel.app',
};

describe('release evidence', () => {
    test('accepts the selected immutable READY Preview and rejects mismatched or moving URLs', () => {
        expect(validateDeployment(preview, status, 'Preview', SHA).url).toBe(status.environment_url);
        expect(() => validateDeployment({ ...preview, sha: BASE }, status, 'Preview', SHA)).toThrow(/SHA/);
        expect(() => validateDeployment(preview, { ...status, environment_url: 'https://dev.chipin.one' }, 'Preview', SHA)).toThrow(/immutable/);
        expect(() => validateDeployment(preview, { ...status, state: 'pending' }, 'Preview', SHA)).toThrow(/success/);
        expect(() => validateDeployment({ ...preview, creator: { login: 'syllik' } }, status, 'Preview', SHA)).toThrow(/vercel/);
    });

    test('unique deployment host passes and git or master aliases throw', () => {
        const unique = 'https://chipin-frontend-lzaemftpe-sylliks-projects.vercel.app';
        expect(validateDeployment(preview, { ...status, environment_url: unique }, 'Preview', SHA).url).toBe(unique);
        expect(() => validateDeployment(preview, { ...status, environment_url: 'https://chipin-frontend-git-master-sylliks-projects.vercel.app' }, 'Preview', SHA)).toThrow(/alias/);
        expect(() => validateDeployment(preview, { ...status, environment_url: 'https://chipin-frontend-master-sylliks-projects.vercel.app' }, 'Preview', SHA)).toThrow(/alias/);
        expect(() => validateDeployment(preview, { ...status, environment_url: 'https://chipin-frontend-sylliks-projects.vercel.app' }, 'Preview', SHA)).toThrow(/alias/);
        expect(() => validateDeployment(preview, { ...status, environment_url: 'https://dev.chipin.one' }, 'Preview', SHA)).toThrow(/alias/);
    });

    test('accepts verified Production deployment at the production domain as baseline evidence', () => {
        expect(validateDeployment({ ...preview, environment: 'Production' }, { state: 'success', environment_url: 'https://chipin.one' }, 'Production').sha).toBe(SHA);
    });

    test('requires exact-SHA successful required CI from trusted app and push run', () => {
        const rule = { required_status_checks: [{ context: 'frontend-ci', integration_id: 15368 }] };
        const checks = [{ name: 'frontend-ci', head_sha: SHA, conclusion: 'success', status: 'completed', app: { id: 15368, slug: 'github-actions' } }];
        const runs = [{ head_sha: SHA, head_branch: 'master', conclusion: 'success', status: 'completed', event: 'push', path: '.github/workflows/frontend-ci.yml' }];
        expect(verifyCi(rule, checks, runs, SHA)).toBe(true);
        expect(() => verifyCi(rule, [{ ...checks[0], head_sha: BASE }], runs, SHA)).toThrow(/exact SHA/);
        expect(() => verifyCi(rule, checks, [{ ...runs[0], conclusion: 'failure' }], SHA)).toThrow(/workflow/);
        expect(() => verifyCi(rule, checks, [{ ...runs[0], head_branch: 'chore/issue-438-release-qa' }], SHA)).toThrow(/workflow/);
        expect(() => verifyCi({ required_status_checks: [] }, checks, runs, SHA)).toThrow(/policy/);
    });

    test('requires every active context at exact SHA and rejects stale earlier success', () => {
        const rule = { required_status_checks: [
            { context: 'frontend-ci', integration_id: 15368 },
            { context: 'security-scan', integration_id: 88 },
        ] };
        const frontend = { id: 10, name: 'frontend-ci', head_sha: SHA, conclusion: 'success', status: 'completed', app: { id: 15368, slug: 'github-actions' } };
        const scan = { id: 11, name: 'security-scan', head_sha: SHA, conclusion: 'success', status: 'completed', app: { id: 88, slug: 'scanner' } };
        const runs = [{ head_sha: SHA, head_branch: 'master', conclusion: 'success', status: 'completed', event: 'push', path: '.github/workflows/frontend-ci.yml' }];
        expect(verifyCi(rule, [frontend, scan], runs, SHA)).toBe(true);
        expect(() => verifyCi(rule, [frontend], runs, SHA)).toThrow(/security-scan/);
        expect(() => verifyCi(rule, [frontend, { ...scan, conclusion: 'failure' }], runs, SHA)).toThrow(/security-scan/);
        expect(() => verifyCi(rule, [frontend, { ...scan, app: { id: 99, slug: 'other' } }], runs, SHA)).toThrow(/security-scan/);
        expect(() => verifyCi(rule, [frontend, scan, { ...scan, id: 12, conclusion: 'failure' }], runs, SHA)).toThrow(/security-scan/);
        expect(() => verifyCi(rule, [frontend, scan], [{ ...runs[0], id: 20 }, { ...runs[0], id: 21, conclusion: 'failure' }], SHA)).toThrow(/workflow/);
    });

    test('required commit-status context uses newest exact-SHA status when no integration ID is specified', () => {
        const rule = { required_status_checks: [
            { context: 'frontend-ci', integration_id: 15368 },
            { context: 'external-policy', integration_id: null },
        ] };
        const frontend = { id: 10, name: 'frontend-ci', head_sha: SHA, conclusion: 'success', status: 'completed', app: { id: 15368, slug: 'github-actions' } };
        const runs = [{ head_sha: SHA, head_branch: 'master', conclusion: 'success', status: 'completed', event: 'push', path: '.github/workflows/frontend-ci.yml' }];
        const status = { id: 40, context: 'external-policy', sha: SHA, state: 'success' };
        expect(verifyCi(rule, [frontend], runs, SHA, [status])).toBe(true);
        expect(() => verifyCi(rule, [frontend], runs, SHA, [status, { ...status, id: 41, state: 'failure' }])).toThrow(/external-policy/);
    });
});

describe('green frontend-ci push run', () => {
    const run = { id: 1, head_sha: SHA, head_branch: 'master', conclusion: 'success', status: 'completed', event: 'push', path: '.github/workflows/frontend-ci.yml' };

    test('needs the newest master push run for the exact SHA to be successful', () => {
        expect(hasGreenFrontendCiRun([run], SHA)).toBe(true);
        expect(hasGreenFrontendCiRun([], SHA)).toBe(false);
        expect(hasGreenFrontendCiRun([{ ...run, status: 'in_progress', conclusion: null }], SHA)).toBe(false);
        expect(hasGreenFrontendCiRun([run, { ...run, id: 2, conclusion: 'failure' }], SHA)).toBe(false);
        expect(hasGreenFrontendCiRun([{ ...run, head_sha: BASE }], SHA)).toBe(false);
        expect(hasGreenFrontendCiRun([{ ...run, event: 'pull_request' }], SHA)).toBe(false);
    });
});

describe('scope and canonical QA identity', () => {
    const issue = { number: 12, html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/12',
        body: '## Acceptance\n- [ ] QA: Open settings => Settings page appears\n' };
    const pull = { number: 20, html_url: 'https://github.com/ChipIn-one/chipin-frontend/pull/20', issues: [12], commits: [SHA, BASE], files: ['src/App.tsx'] };
    const primary = { issue: 12, step: 'Open settings', expected: 'Settings page appears' };

    test('deduplicates a multi-commit PR and derives only explicit steps and expected results', () => {
        const plan = buildChecklist({ files: ['src/App.tsx'], commits: [SHA, BASE], pulls: [pull], issues: [issue] });
        expect(plan.kind).toBe('checks');
        expect(plan.checks).toEqual([primary]);
        expect(plan.included).toEqual([{ issue: 12, pulls: [20] }]);
        expect(plan.missingSteps).toEqual([]);
        expect(plan.smoke).toBe(false);
    });

    test('a compare with only CI, workflow, test or docs files needs no manual QA, even with unlinked commits', () => {
        const files = ['.github/workflows/frontend-ci.yml', 'scripts/release-qa/core.mjs', 'src/App.test.tsx', 'docs/help.md'];
        const result = buildChecklist({ files, commits: [SHA, BASE],
            pulls: [{ ...pull, commits: [SHA], files: ['.github/workflows/frontend-ci.yml', 'src/App.test.tsx'] }],
            issues: [issue], commitFiles: { [BASE]: ['docs/help.md', 'scripts/release-qa/core.mjs'] } });
        expect(result).toMatchObject({ kind: 'none', reason: 'NO_MANUAL_QA_REQUIRED', evidence: files,
            included: [{ issue: 12, pulls: [20] }], noQa: [{ commit: BASE }] });
    });

    test('an included UI Issue without QA lines gets the check-against-Acceptance line instead of blocking', () => {
        const result = buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [{ ...pull, commits: [SHA] }],
            issues: [{ ...issue, body: '## Acceptance\n- [ ] Works' }] });
        expect(result.kind).toBe('checks');
        expect(result.checks).toEqual([{ issue: 12, step: 'check against the Acceptance of #12', expected: issue.html_url, missing: true }]);
        expect(result.missingSteps).toEqual([12]);
    });

    test('an unlinked Dependabot commit that changes only package files or workflows does not block', () => {
        const dependabot = { number: 30, issues: [], commits: [BASE], files: ['package.json', 'package-lock.json', '.github/workflows/frontend-ci.yml'] };
        const result = buildChecklist({ files: ['src/App.tsx', 'package.json', 'package-lock.json', '.github/workflows/frontend-ci.yml'],
            commits: [SHA, BASE], pulls: [{ ...pull, commits: [SHA] }, dependabot], issues: [issue] });
        expect(result.checks).toEqual([primary]);
        expect(result.noQa).toEqual([{ pull: 30, commits: [BASE] }]);
        expect(result.included).toEqual([{ issue: 12, pulls: [20] }]);
    });

    test('an unlinked commit or PR under src/ still blocks', () => {
        expect(() => buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [], issues: [], commitFiles: { [SHA]: ['src/App.tsx'] } })).toThrow(/unlinked commit.*UI-affecting/);
        expect(() => buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [], issues: [] })).toThrow(/unlinked commit/);
        expect(() => buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [{ ...pull, commits: [SHA], issues: [] }], issues: [] })).toThrow(/PR #20.*UI-affecting/);
        expect(() => buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [{ ...pull, commits: [SHA], issues: [12, 13] }], issues: [issue] })).toThrow(/PR #20.*UI-affecting/);
    });

    test('a linked PR without readable files fails closed', () => {
        expect(() => buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [{ ...pull, commits: [SHA], files: undefined }], issues: [issue] })).toThrow(/files/);
    });

    test('mixed candidate omits manual checks for a linked non-UI PR', () => {
        const docsPull = { number: 21, issues: [13], commits: [BASE], files: ['docs/help.md'] };
        const result = buildChecklist({ files: ['src/App.tsx', 'docs/help.md'], commits: [SHA, BASE],
            pulls: [{ ...pull, commits: [SHA] }, docsPull],
            issues: [issue, { number: 13, body: '## Acceptance\n- [ ] Documentation updated' }] });
        expect(result.checks).toEqual([primary]);
        expect(result.missingSteps).toEqual([]);
        expect(result.included).toEqual([{ issue: 12, pulls: [20] }, { issue: 13, pulls: [21] }]);
    });

    test('uses an explicit when/then acceptance criterion without guessing a scenario', () => {
        const result = buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [{ ...pull, commits: [SHA] }],
            issues: [{ ...issue, body: '## Acceptance\n- [ ] When a member opens settings, then the settings page appears' }] });
        expect(result.checks).toEqual([{ issue: 12, step: 'a member opens settings', expected: 'the settings page appears' }]);
    });

    test('a risky path appends the five SMOKE-SHORT checks once and AUTH-041 is not duplicated', () => {
        const result = buildChecklist({
            files: ['src/store/authStore.ts', 'src/helpers/authSession.ts', 'src/api/groupsApi.ts'], commits: [SHA, BASE],
            pulls: [
                { ...pull, commits: [SHA], files: ['src/store/authStore.ts', 'src/helpers/authSession.ts'] },
                { number: 21, issues: [12], commits: [BASE], files: ['src/api/groupsApi.ts'] },
            ], issues: [issue],
        });
        expect(result.smoke).toBe(true);
        expect(result.checks[0]).toEqual(primary);
        const smoke = result.checks.filter(item => item.smoke);
        expect(smoke).toHaveLength(5);
        expect(result.checks).toHaveLength(6);
        expect(smoke.map(item => item.step).join('\n')).toMatch(/Google sign-in[\s\S]*split equally[\s\S]*other participant[\s\S]*language and theme[\s\S]*Log out/);
        const auth = result.checks.filter(item => item.source === 'AUTH-041');
        expect(auth).toHaveLength(1);
        expect(auth[0]).toMatchObject({ smoke: true,
            sourceUrl: 'https://github.com/ChipIn-one/chipin-knowledge-base/blob/681d392140f33d4a47e3059eb53f77a2ee2c72c8/common/specs/auth.md' });
        expect(auth[0].expected).toMatch(/no restored browser session/i);
        expect(auth[0].expected).not.toMatch(/access.token.*revok/i);
    });

    test('routing, bootstrap, service worker, theme and vercel.json trigger SMOKE-SHORT; tests and plain UI do not', () => {
        for (const file of ['src/features/routing/AppRouter.tsx', 'src/root.tsx', 'src/bootstrap/initializeApi.ts',
            'src/helpers/serviceWorkerRecovery.ts', 'src/helpers/theme.ts', 'vercel.json', 'vite.config.ts']) {
            const result = buildChecklist({ files: [file], commits: [SHA], pulls: [{ ...pull, commits: [SHA], files: [file] }], issues: [issue] });
            expect(result.smoke, file).toBe(true);
        }
        const plain = buildChecklist({ files: ['src/App.tsx', 'src/api/groupsApi.test.ts'], commits: [SHA],
            pulls: [{ ...pull, commits: [SHA], files: ['src/App.tsx', 'src/api/groupsApi.test.ts'] }], issues: [issue] });
        expect(plain.smoke).toBe(false);
        expect(plain.checks).toEqual([primary]);
    });

    test('a dependencies-only bump from an unlinked commit is build-affecting: QA Issue with SMOKE-SHORT once, no block', () => {
        const files = ['package.json', 'package-lock.json'];
        const result = buildChecklist({ files, commits: [SHA], pulls: [], issues: [], commitFiles: { [SHA]: files },
            buildChanges: ['package.json dependencies: i18next', 'package-lock.json: i18next'] });
        expect(result).toMatchObject({ kind: 'checks', smoke: true, noQa: [{ commit: SHA }], included: [],
            buildAffecting: ['package.json dependencies: i18next', 'package-lock.json: i18next'] });
        expect(result.checks).toHaveLength(5);
        expect(result.checks.every(item => item.smoke)).toBe(true);
        const body = buildIssueBody({ sha: SHA, baselineSha: BASE, deploymentId: 42, url: status.environment_url, plan: result });
        expect(body).toContain('### Build-affecting changes\n- package.json dependencies: i18next\n- package-lock.json: i18next');
        expect((body.match(/- \[ \] SMOKE-SHORT: /g) ?? [])).toHaveLength(5);
    });

    test('a lint/test devDependency bump with no build change stays NO_MANUAL_QA_REQUIRED', () => {
        const files = ['package.json', 'package-lock.json'];
        expect(buildChecklist({ files, commits: [SHA], pulls: [], issues: [], commitFiles: { [SHA]: files }, buildChanges: [] }))
            .toMatchObject({ kind: 'none', reason: 'NO_MANUAL_QA_REQUIRED' });
    });

    test('tsconfig.app.json and scripts/version-resolver.mjs are build-affecting by path', () => {
        for (const file of ['tsconfig.app.json', 'scripts/version-resolver.mjs']) {
            const result = buildChecklist({ files: [file], commits: [SHA], pulls: [], issues: [], commitFiles: { [SHA]: [file] } });
            expect(result, file).toMatchObject({ kind: 'checks', smoke: true, buildAffecting: [file] });
        }
    });

    test('a build-affecting change forces SMOKE-SHORT next to plain UI work, once, without AUTH-041 duplicates', () => {
        const result = buildChecklist({ files: ['src/App.tsx', 'tsconfig.app.json'], commits: [SHA, BASE],
            pulls: [{ ...pull, commits: [SHA] }], issues: [issue], commitFiles: { [BASE]: ['tsconfig.app.json'] } });
        expect(result.smoke).toBe(true);
        expect(result.checks[0]).toEqual(primary);
        expect(result.checks.filter(item => item.smoke)).toHaveLength(5);
        expect(result.checks.filter(item => item.source === 'AUTH-041')).toHaveLength(1);
    });

    test('the QA Issue renders primary, missing-steps and smoke lines with => separators', () => {
        const plan = buildChecklist({ files: ['src/App.tsx', 'vercel.json'], commits: [SHA, BASE],
            pulls: [{ ...pull, commits: [SHA] }, { number: 21, issues: [13], commits: [BASE], files: ['vercel.json'] }],
            issues: [issue, { number: 13, html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/13', body: 'No QA lines' }] });
        const body = buildIssueBody({ sha: SHA, baselineSha: BASE, deploymentId: 42, url: status.environment_url, plan });
        expect(body).toContain('- [ ] #12: Open settings => Settings page appears\n');
        expect(body).toContain('- [ ] #13: check against the Acceptance of #13 => https://github.com/ChipIn-one/chipin-frontend/issues/13\n');
        expect((body.match(/- \[ \] SMOKE-SHORT: /g) ?? [])).toHaveLength(5);
        expect(body).toMatch(/QA PASS/);
    });

    test('the QA Issue links the Russian tester guide on master next to the QA result section', () => {
        const body = buildIssueBody({ sha: SHA, baselineSha: BASE, deploymentId: 42, url: status.environment_url, plan: buildChecklist({ files: ['src/App.tsx'], commits: [SHA, BASE], pulls: [pull], issues: [issue] }) });
        const guide = 'https://github.com/ChipIn-one/chipin-frontend/blob/master/docs/qa/README.md';
        const resultSection = body.slice(body.indexOf('### QA result'), body.indexOf('### Defects and retest'));
        expect(resultSection).toContain(`Tester guide (Russian): ${guide}`);
        expect(body).toContain(`## References\n- ${guide}\n`);
    });

    test('reuses exact repository/SHA marker but rejects conflicting deployment identity', () => {
        const body = buildIssueBody({ sha: SHA, baselineSha: BASE, deploymentId: 42, url: status.environment_url, plan: buildChecklist({ files: ['src/App.tsx'], commits: [SHA, BASE], pulls: [pull], issues: [issue] }) });
        expect(body).toContain(`chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42`);
        expect(findQaIssue([{ number: 91, body }], SHA, 42, status.environment_url)?.number).toBe(91);
        expect(() => findQaIssue([{ number: 91, body }], SHA, 43, status.environment_url)).toThrow(/conflicting deployment/);
        expect(findQaIssue([{ number: 91, body }], BASE, 42, status.environment_url)).toBeNull();
        expect(() => findQaIssue([{ number: 91, body }, { number: 92, body }], SHA, 42, status.environment_url)).toThrow(/duplicate/);
    });
});

describe('authorized QA result', () => {
    const issue = { body: `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->`, assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }] };
    const comment = { body: 'QA PASS', user: { login: 'SoRawSteak', type: 'User' }, created_at: '2026-10-23T11:00:00Z', updated_at: '2026-10-23T11:00:00Z' };

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
        for (const body of ['QA PASSED', '**QA PASS**', 'QA PASS.', '  qa: pass', '> QA fail', 'qa']) expect(isNearMissResult(body), body).toBe(true);
        for (const body of ['QA PASS', ' qa blocked \nnotes', 'Looks good, QA PASS', 'Starting now', '', undefined]) expect(isNearMissResult(body), String(body)).toBe(false);
    });

    test('accepts only the sole assigned human QA in a new unedited comment and pins the marker SHA', () => {
        expect(parseQaResult(comment, issue)).toEqual({ outcome: 'PASS', sha: SHA, qa: 'SoRawSteak' });
        expect(parseQaResult({ ...comment, body: ' qa fail \nSettle up is broken' }, issue)).toMatchObject({ outcome: 'FAIL' });
        expect(() => parseQaResult({ ...comment, user: { login: 'syllik', type: 'User' } }, issue)).toThrow(/assigned QA/);
        expect(() => parseQaResult({ ...comment, user: { login: 'someone', type: 'User' } }, issue)).toThrow(/assigned QA/);
        expect(() => parseQaResult({ ...comment, user: { login: 'SoRawSteak', type: 'Bot' } }, issue)).toThrow(/human/);
        expect(() => parseQaResult({ ...comment, updated_at: '2026-10-23T11:01:00Z' }, issue)).toThrow(/edited/);
        expect(() => parseQaResult({ ...comment, body: 'Not done yet' }, issue)).toThrow(/QA PASS/);
        expect(() => parseQaResult(comment, { ...issue, assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }, { login: 'other' }] })).toThrow(/sole/);
    });

    test('formats one Slack result line with the owner mention or plain login', () => {
        const result = { outcome: 'PASS', sha: SHA, qa: 'SoRawSteak' };
        const issueUrl = 'https://github.com/ChipIn-one/chipin-frontend/issues/50';
        expect(formatResultLine({ result, issueUrl, userMap: '{"syllik":"U0OWNER123"}' }))
            .toBe(`<@U0OWNER123> Frontend QA PASS by SoRawSteak for ${SHA}: ${issueUrl}`);
        expect(formatResultLine({ result, issueUrl, userMap: '{}' })).toBe(`syllik Frontend QA PASS by SoRawSteak for ${SHA}: ${issueUrl}`);
        expect(formatResultLine({ result, issueUrl, userMap: 'not json' })).toMatch(/^syllik /);
        expect(formatResultLine({ result, issueUrl, userMap: '{"syllik":"<!channel>"}' })).toMatch(/^syllik /);
    });

    test('requires write token and an explicit identity map before handoff', () => {
        expect(() => assertConfiguration({ CHIPIN_DEV_READ_TOKEN: 'read', SLACK_WEBHOOK_CI: 'https://hooks.slack.com/services/a/b/c', SLACK_USER_MAP: '{"SoRawSteak":"U0C9X8T4R2Q"}' }, 'SoRawSteak')).toThrow(/CHIPIN_ISSUE_WRITE_TOKEN/);
        expect(() => assertConfiguration({ CHIPIN_DEV_READ_TOKEN: 'read', CHIPIN_ISSUE_WRITE_TOKEN: 'write', SLACK_WEBHOOK_CI: 'https://hooks.slack.com/services/a/b/c', SLACK_USER_MAP: '{}' }, 'SoRawSteak')).toThrow(/SLACK_USER_MAP/);
    });
});
