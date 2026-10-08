import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { evaluateReleaseSource } from './release-source-policy.mjs';

const repository = 'ChipIn-one/chipin-frontend';
const release = body => evaluateReleaseSource({
    baseRef: 'main',
    headRef: 'dev',
    headRepository: repository,
    repository,
    body,
});

describe('release source policy', () => {
    test('accepts the normal same-repository dev to main release', () => {
        expect(release('Includes #376')).toEqual({
            allowed: true,
            route: 'release',
        });
    });

    test.each([
        'close #376',
        'Closes #376',
        'CLOSED #376',
        'FIX #376',
        'FiXeS #376',
        'fixed #376',
        'Resolve #376',
        'rEsoLVes #376',
        'resolved #376',
        'Close: #376',
        'Fixes:\n#376',
        'Close `#376`',
        'Closes [#376](https://github.com/ChipIn-one/chipin-frontend/issues/376)',
        'Fixes ChipIn-one/chipin-frontend#376',
        'FixEd CHIPIN-ONE/CHIPIN-FRONTEND#376',
        'Resolves https://github.com/ChipIn-one/chipin-frontend/issues/376',
        'Resolve HTTPS://GITHUB.COM/CHIPIN-ONE/CHIPIN-FRONTEND/ISSUES/376',
        'Fixes other/repository#55, #376',
        'Fixes other/repository#55 and ChipIn-one/chipin-frontend#376',
        '## Release\nIncludes #378\n\nDo not close #376 from the release PR',
    ])('blocks a local GitHub closing reference in a release body: %s', body => {
        const decision = release(body);

        expect(decision.allowed).toBe(false);
        expect(decision.route).toBe('blocked');
        expect(decision.reason).toContain('Frontend production completion');
    });

    test('reports the line containing an unsafe closing keyword', () => {
        expect(release('Included #378\n\nCloses #376').reason).toContain('line 3');
    });

    test.each([
        '',
        'Includes #376 — implemented by PR #377',
        'See #376 and https://github.com/ChipIn-one/chipin-frontend/issues/376',
        'See implementation PR: https://github.com/ChipIn-one/chipin-frontend/pull/377',
        'Related: ChipIn-one/chipin-frontend#376',
        'Fixing #376 does not itself signal completion',
        'Close issue #376 only after completion (not a GitHub closing directive)',
        'Fixes other/repository#55',
        'Fixes ChipIn-one/chipin-backend#55',
        'Fixes https://github.com/other/repository/issues/55',
        'Closes #not-an-issue',
    ])('allows non-closing and nonlocal references in release bodies: %s', body => {
        expect(release(body)).toEqual({ allowed: true, route: 'release' });
    });

    test('rejects an arbitrary same-repository branch targeting main', () => {
        const decision = evaluateReleaseSource({
            baseRef: 'main',
            headRef: 'feature/unrelated',
            headRepository: repository,
            repository,
            body: 'Includes #376',
        });

        expect(decision.allowed).toBe(false);
        expect(decision.route).toBe('blocked');
    });

    test('rejects a fork branch named dev targeting main', () => {
        const decision = evaluateReleaseSource({
            baseRef: 'main',
            headRef: 'dev',
            headRepository: 'attacker/chipin-frontend',
            repository,
            body: 'Includes #376',
        });

        expect(decision.allowed).toBe(false);
    });

    test('keeps a simulated Dependabot security PR to main blocked', () => {
        const decision = evaluateReleaseSource({
            baseRef: 'main',
            headRef: 'dependabot/npm_and_yarn/axios-1.20.1',
            headRepository: repository,
            repository,
        });

        expect(decision.allowed).toBe(false);
        expect(decision.reason).toContain('integrate the reviewed fix through dev');
    });

    test('allows the supported security integration route into dev', () => {
        expect(evaluateReleaseSource({
            baseRef: 'dev',
            headRef: 'luna/issue-224-axios-security-fix',
            headRepository: repository,
            repository,
            body: 'Closes #376',
        })).toEqual({
            allowed: true,
            route: 'integration',
        });
    });

    test('fails closed when a main-target PR is missing repository identity', () => {
        expect(evaluateReleaseSource({
            baseRef: 'main',
            headRef: 'dev',
            headRepository: '',
            repository,
        }).allowed).toBe(false);
    });

    test.each(['frontend-ci.yml', 'main-ci.yml'])('CI %s validates body on edits', workflow => {
        const text = readFileSync(resolve('.github/workflows', workflow), 'utf8');

        expect(text).toContain('ready_for_review, edited');
        expect(text).toContain("PR_BODY: ${{ github.event.pull_request.body || '' }}");
        expect(text).toContain('run: node scripts/release-source-policy.mjs');
    });

    test.each([
        ['Close #376', 1],
        ['Includes #376', 0],
    ])('CLI exit code tracks release description policy: %s', (body, expectedStatus) => {
        const run = spawnSync(process.execPath, [resolve('scripts/release-source-policy.mjs')], {
            env: {
                ...process.env,
                BASE_REF: 'main',
                HEAD_REF: 'dev',
                HEAD_REPOSITORY: repository,
                THIS_REPOSITORY: repository,
                PR_BODY: body,
            },
            encoding: 'utf8',
        });

        expect(run.status).toBe(expectedStatus);
    });

    test('CLI fails closed when PR_BODY is missing for main', () => {
        const env = {
            ...process.env,
            BASE_REF: 'main',
            HEAD_REF: 'dev',
            HEAD_REPOSITORY: repository,
            THIS_REPOSITORY: repository,
        };
        delete env.PR_BODY;

        const run = spawnSync(process.execPath, [resolve('scripts/release-source-policy.mjs')], {
            env,
            encoding: 'utf8',
        });

        expect(run.status).toBe(1);
        expect(run.stderr).toContain('PR_BODY is missing');
    });
});
