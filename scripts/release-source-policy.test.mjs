import { describe, expect, test } from 'vitest';

import { evaluateReleaseSource } from './release-source-policy.mjs';

const repository = 'ChipIn-one/chipin-frontend';

describe('release source policy', () => {
    test('accepts the normal same-repository dev to main release', () => {
        expect(evaluateReleaseSource({
            baseRef: 'main',
            headRef: 'dev',
            headRepository: repository,
            repository,
        })).toEqual({
            allowed: true,
            route: 'release',
        });
    });

    test('rejects an arbitrary same-repository branch targeting main', () => {
        const decision = evaluateReleaseSource({
            baseRef: 'main',
            headRef: 'feature/unrelated',
            headRepository: repository,
            repository,
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
});
