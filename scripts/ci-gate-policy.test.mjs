import { describe, expect, test } from 'vitest';

import { isDocsOnlyChange, resolveCiGateMode } from './ci-gate-policy.mjs';

describe('CI gate policy', () => {
    test('treats ordinary Markdown documentation as docs-only', () => {
        expect(isDocsOnlyChange([
            'README.md',
            'docs/api-notes/activity.md',
            'docs/engineering/code-review.md',
        ])).toBe(true);
    });

    test('fails closed for empty or mixed change sets', () => {
        expect(isDocsOnlyChange([])).toBe(false);
        expect(isDocsOnlyChange(['docs/api-notes/activity.md', 'src/main.tsx'])).toBe(false);
    });

    test('does not fast-path repository rules, security policy, AI context, or workflow changes', () => {
        for (const path of [
            'docs/engineering/rules/00-foundation.md',
            'docs/dependabot-security-updates.md',
            'AGENTS.md',
            '.ai/context.md',
            '.github/workflows/frontend-ci.yml',
        ]) {
            expect(isDocsOnlyChange([path])).toBe(false);
        }
    });

    test('keeps frontend-ci as the heavy gate for code changes targeting master', () => {
        expect(resolveCiGateMode({
            workflow: 'frontend-ci',
            targetBranch: 'master',
            changedFiles: ['src/main.tsx'],
        })).toBe('full');
    });

    test('fast-paths docs-only master events without dropping the required check', () => {
        expect(resolveCiGateMode({
            workflow: 'frontend-ci',
            targetBranch: 'master',
            changedFiles: ['docs/api-notes/activity.md'],
        })).toBe('docs-only');
    });

    test('rejects unsupported workflows and the retired dev/main branches', () => {
        expect(() => resolveCiGateMode({
            workflow: 'main-ci',
            targetBranch: 'master',
            changedFiles: ['src/main.tsx'],
        })).toThrow('Unsupported CI workflow');
        for (const targetBranch of ['dev', 'main']) {
            expect(() => resolveCiGateMode({
                workflow: 'frontend-ci',
                targetBranch,
                changedFiles: ['src/main.tsx'],
            })).toThrow('Unsupported CI target branch');
        }
    });
});
