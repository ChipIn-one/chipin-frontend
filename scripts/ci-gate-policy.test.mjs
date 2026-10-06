import { describe, expect, test } from 'vitest';

import { isDocsOnlyChange, resolveCiGateMode } from './ci-gate-policy.mjs';

describe('CI gate policy', () => {
    test('treats ordinary Markdown documentation as docs-only', () => {
        expect(isDocsOnlyChange([
            'README.md',
            'docs/api-notes/activity.md',
            'docs/codex/review-instruction-loading.md',
        ])).toBe(true);
    });

    test('fails closed for empty or mixed change sets', () => {
        expect(isDocsOnlyChange([])).toBe(false);
        expect(isDocsOnlyChange(['docs/api-notes/activity.md', 'src/main.tsx'])).toBe(false);
    });

    test('does not fast-path repository rules, security policy, AI context, or workflow changes', () => {
        for (const path of [
            'docs/codex/rules/00-foundation.md',
            'docs/dependabot-security-updates.md',
            'AGENTS.md',
            '.ai/context.md',
            '.github/workflows/frontend-ci.yml',
        ]) {
            expect(isDocsOnlyChange([path])).toBe(false);
        }
    });

    test('keeps frontend-ci as the heavy gate for code changes targeting dev', () => {
        expect(resolveCiGateMode({
            workflow: 'frontend-ci',
            targetBranch: 'dev',
            changedFiles: ['src/main.tsx'],
        })).toBe('full');
    });

    test('uses a cheap successful frontend-ci compatibility wrapper for main', () => {
        expect(resolveCiGateMode({
            workflow: 'frontend-ci',
            targetBranch: 'main',
            changedFiles: ['src/main.tsx'],
        })).toBe('compatibility');
    });

    test('keeps main-ci as the only heavy main gate for code changes', () => {
        expect(resolveCiGateMode({
            workflow: 'main-ci',
            targetBranch: 'main',
            changedFiles: ['src/main.tsx'],
        })).toBe('full');
    });

    test('fast-paths docs-only dev and main events without dropping the required check', () => {
        const changedFiles = ['docs/api-notes/activity.md'];

        expect(resolveCiGateMode({
            workflow: 'frontend-ci',
            targetBranch: 'dev',
            changedFiles,
        })).toBe('docs-only');
        expect(resolveCiGateMode({
            workflow: 'main-ci',
            targetBranch: 'main',
            changedFiles,
        })).toBe('docs-only');
    });

    test('rejects unsupported workflow and branch combinations', () => {
        expect(() => resolveCiGateMode({
            workflow: 'other',
            targetBranch: 'dev',
            changedFiles: ['src/main.tsx'],
        })).toThrow('Unsupported CI workflow');
        expect(() => resolveCiGateMode({
            workflow: 'main-ci',
            targetBranch: 'dev',
            changedFiles: ['src/main.tsx'],
        })).toThrow('main-ci may only validate main');
    });
});
