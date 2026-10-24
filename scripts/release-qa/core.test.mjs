import { describe, expect, test } from 'vitest';
import {
    assertConfiguration, buildChecklist, buildIssueBody, findQaIssue,
    parseQaResult, validateDeployment, verifyCi,
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

describe('scope and canonical QA identity', () => {
    const issue = { number: 12, html_url: 'https://github.com/ChipIn-one/chipin-frontend/issues/12',
        body: '## Acceptance\n- [ ] QA: Open settings => Settings page appears\n' };
    const pull = { number: 20, html_url: 'https://github.com/ChipIn-one/chipin-frontend/pull/20', issues: [12], commits: [SHA, BASE] };

    test('deduplicates a multi-commit PR and derives only explicit steps and expected results', () => {
        const plan = buildChecklist({ files: ['src/App.tsx'], commits: [SHA, BASE], pulls: [pull], issues: [issue] });
        expect(plan.kind).toBe('checks');
        expect(plan.checks).toEqual([{ issue: 12, step: 'Open settings', expected: 'Settings page appears' }]);
        expect(plan.included).toEqual([{ issue: 12, pulls: [20] }]);
    });

    test('blocks unlinked user-facing work and unspecified acceptance', () => {
        expect(() => buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [], issues: [] })).toThrow(/unlinked/);
        expect(() => buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [pull], issues: [{ ...issue, body: '## Acceptance\n- [ ] Works' }] })).toThrow(/explicit QA/);
    });

    test('docs-only requires linked commit and canonical Issue evidence before no-manual result', () => {
        expect(() => buildChecklist({ files: ['docs/help.md'], commits: [SHA], pulls: [], issues: [] })).toThrow(/unlinked/);
        expect(buildChecklist({ files: ['docs/help.md'], commits: [SHA], pulls: [{ ...pull, commits: [SHA], docsOnly: true }], issues: [issue] }))
            .toMatchObject({ kind: 'none', reason: 'NO_MANUAL_QA_REQUIRED', included: [{ issue: 12, pulls: [20] }] });
    });

    test('mixed candidate omits manual checks for a proven docs-only PR', () => {
        const docsPull = { number: 21, issues: [13], commits: [BASE], docsOnly: true };
        const result = buildChecklist({ files: ['src/App.tsx', 'docs/help.md'], commits: [SHA, BASE],
            pulls: [{ ...pull, commits: [SHA] }, docsPull],
            issues: [issue, { number: 13, body: '## Acceptance\n- [ ] Documentation updated' }] });
        expect(result.checks).toEqual([{ issue: 12, step: 'Open settings', expected: 'Settings page appears' }]);
        expect(result.included).toEqual([{ issue: 12, pulls: [20] }, { issue: 13, pulls: [21] }]);
    });

    test('uses an explicit when/then acceptance criterion without guessing a scenario', () => {
        const result = buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [{ ...pull, commits: [SHA] }],
            issues: [{ ...issue, body: '## Acceptance\n- [ ] When a member opens settings, then the settings page appears' }] });
        expect(result.checks).toEqual([{ issue: 12, step: 'a member opens settings', expected: 'the settings page appears' }]);
    });

    test('auth/session impact rule adds one targeted sourced regression per Issue after primary acceptance', () => {
        const result = buildChecklist({
            files: ['src/store/authStore.ts', 'src/helpers/authSession.ts'], commits: [SHA],
            pulls: [{ ...pull, commits: [SHA], files: ['src/store/authStore.ts', 'src/helpers/authSession.ts'] }], issues: [issue],
        });
        expect(result.checks).toHaveLength(2);
        expect(result.checks[1]).toMatchObject({ issue: 12, source: 'AUTH-041',
            sourceUrl: 'https://github.com/ChipIn-one/chipin-knowledge-base/blob/681d392140f33d4a47e3059eb53f77a2ee2c72c8/common/specs/auth.md' });
        expect(result.checks[1].step).toMatch(/Log out.*reload.*protected page/i);
        expect(result.checks[1].expected).toMatch(/no restored browser session/i);
        expect(result.checks[1].expected).not.toMatch(/access.token.*revok/i);
    });

    test('unrelated paths add no impact regression and impact rules never replace missing primary acceptance', () => {
        const unrelated = buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [{ ...pull, commits: [SHA], files: ['src/App.tsx'] }], issues: [issue] });
        expect(unrelated.checks).toHaveLength(1);
        expect(() => buildChecklist({ files: ['src/store/authStore.ts'], commits: [SHA],
            pulls: [{ ...pull, commits: [SHA], files: ['src/store/authStore.ts'] }],
            issues: [{ ...issue, body: '## Acceptance\n- [ ] Works' }] })).toThrow(/explicit QA/);
    });

    test('repeated matching auth paths on one Issue append a single sourced impact check', () => {
        const result = buildChecklist({
            files: ['src/store/authStore.ts', 'src/features/routing/ProtectedRoute.tsx'],
            commits: [SHA, BASE],
            pulls: [
                { ...pull, commits: [SHA], files: ['src/store/authStore.ts'] },
                { number: 21, issues: [12], commits: [BASE], files: ['src/features/routing/ProtectedRoute.tsx'] },
            ],
            issues: [issue],
        });
        const impact = result.checks.filter(item => item.source === 'AUTH-041');
        expect(impact).toHaveLength(1);
        expect(impact[0]).toMatchObject({ issue: 12, source: 'AUTH-041' });
        expect(result.included).toEqual([{ issue: 12, pulls: [20, 21] }]);
    });

    test('reuses exact repository/SHA marker but rejects conflicting deployment identity', () => {
        const body = buildIssueBody({ sha: SHA, baselineSha: BASE, deploymentId: 42, url: status.environment_url, plan: buildChecklist({ files: ['src/App.tsx'], commits: [SHA], pulls: [pull], issues: [issue] }) });
        expect(body).toContain(`chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42`);
        expect(findQaIssue([{ number: 91, body }], SHA, 42, status.environment_url)?.number).toBe(91);
        expect(() => findQaIssue([{ number: 91, body }], SHA, 43, status.environment_url)).toThrow(/conflicting deployment/);
        expect(findQaIssue([{ number: 91, body }], BASE, 42, status.environment_url)).toBeNull();
        expect(() => findQaIssue([{ number: 91, body }, { number: 92, body }], SHA, 42, status.environment_url)).toThrow(/duplicate/);
    });
});

describe('authorized QA result', () => {
    const issue = { body: `<!-- chipin-release-qa:v1 repo=ChipIn-one/chipin-frontend sha=${SHA} deployment=42 -->`, assignees: [{ login: 'syllik' }, { login: 'SoRawSteak' }] };
    const comment = { body: `QA RESULT: PASS\nSHA: ${SHA}\nTOTAL TIME: 45m`, user: { login: 'SoRawSteak', type: 'User' }, created_at: '2026-10-23T11:00:00Z', updated_at: '2026-10-23T11:00:00Z' };

    test('accepts only assigned human result with exact SHA and total time', () => {
        expect(parseQaResult(comment, issue, SHA)).toMatchObject({ outcome: 'PASS', minutes: 45 });
        expect(() => parseQaResult({ ...comment, user: { login: 'syllik', type: 'User' } }, issue, SHA)).toThrow(/assigned QA/);
        expect(() => parseQaResult({ ...comment, updated_at: '2026-10-23T11:01:00Z' }, issue, SHA)).toThrow(/edited/);
        expect(() => parseQaResult({ ...comment, body: comment.body.replace(SHA, BASE) }, issue, SHA)).toThrow(/SHA/);
        expect(() => parseQaResult({ ...comment, body: comment.body + '\nQA RESULT: FAIL' }, issue, SHA)).toThrow(/ambiguous/);
    });

    test('requires write token and an explicit identity map before handoff', () => {
        expect(() => assertConfiguration({ CHIPIN_DEV_READ_TOKEN: 'read', SLACK_WEBHOOK_CI: 'https://hooks.slack.com/services/a/b/c', SLACK_USER_MAP: '{"SoRawSteak":"U0C9X8T4R2Q"}' }, 'SoRawSteak')).toThrow(/CHIPIN_ISSUE_WRITE_TOKEN/);
        expect(() => assertConfiguration({ CHIPIN_DEV_READ_TOKEN: 'read', CHIPIN_ISSUE_WRITE_TOKEN: 'write', SLACK_WEBHOOK_CI: 'https://hooks.slack.com/services/a/b/c', SLACK_USER_MAP: '{}' }, 'SoRawSteak')).toThrow(/SLACK_USER_MAP/);
    });
});
