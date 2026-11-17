import { describe, expect, it } from 'vitest';

import {
    LOCAL_DEV_SERVER_ORIGIN,
    previewBypassHeaders,
    resolveE2eBasicAuth,
    resolveE2eTarget,
    resolvePreviewBypass,
} from './config';

describe('resolveE2eTarget', () => {
    it('starts the local dev server when no target is given', () => {
        expect(resolveE2eTarget({})).toEqual({
            baseUrl: LOCAL_DEV_SERVER_ORIGIN,
            kind: 'local-dev-server',
        });
        expect(resolveE2eTarget({ CHIPIN_E2E_BASE_URL: '  ' })).toEqual({
            baseUrl: LOCAL_DEV_SERVER_ORIGIN,
            kind: 'local-dev-server',
        });
    });

    it.each(['http://localhost:5173', 'http://localhost:4173/', 'http://127.0.0.1:5173'])(
        'accepts the local app origin %s',
        baseUrl => {
            expect(resolveE2eTarget({ CHIPIN_E2E_BASE_URL: baseUrl })).toEqual({
                baseUrl: baseUrl.replace(/\/$/, ''),
                kind: 'local',
            });
        },
    );

    it.each([
        'https://chipin-frontend-fzwunx6is-sylliks-projects.vercel.app',
        'https://chipin-frontend-git-test-issue-663-sylliks-projects.vercel.app/',
    ])("accepts and normalizes this project's Vercel Preview origin %s", baseUrl => {
        expect(resolveE2eTarget({ CHIPIN_E2E_BASE_URL: baseUrl })).toEqual({
            baseUrl: baseUrl.replace(/\/$/, ''),
            kind: 'vercel-preview',
        });
    });

    it.each([
        'https://chipin.one',
        'https://www.chipin.one/',
        'https://app.chipin.one',
        'https://api.chipin.one',
        'http://chipin.one',
        'https://app.chipin.one:8443',
        'https://chipin.one/dashboard',
    ])('rejects the production origin %s before anything else', baseUrl => {
        expect(() => resolveE2eTarget({ CHIPIN_E2E_BASE_URL: baseUrl })).toThrow(
            'Production e2e target is forbidden',
        );
    });

    it.each([
        'not-a-url',
        'https://localhost:5173',
        'http://example.com',
        'https://dev.chipin.one',
        'https://app-dev.chipin.one',
        'https://api-dev.chipin.one',
        'https://preview.vercel.app',
        'https://chipin-frontend-git-test-chipin.vercel.app',
        'https://other-app-fzwunx6is-sylliks-projects.vercel.app',
        'https://chipin-frontend-fzwunx6is-other-team.vercel.app',
        'https://chipin-frontend--sylliks-projects.vercel.app',
        'https://chipin-frontend-sylliks-projects.vercel.app',
        'https://x.chipin-frontend-fzwunx6is-sylliks-projects.vercel.app',
        'https://chipin-frontend-fzwunx6is-sylliks-projects.vercel.app.example.com',
        'http://chipin-frontend-fzwunx6is-sylliks-projects.vercel.app',
        'https://chipin-frontend-fzwunx6is-sylliks-projects.vercel.app:8443',
        'http://preview.vercel.app',
        'https://preview.vercel.app:8443',
        'https://.vercel.app',
        'https://vercel.app',
        'https://preview.vercel.app.example.com',
        'https://user:password@preview.vercel.app',
        'https://preview.vercel.app/dashboard',
        'https://preview.vercel.app?query=1',
        'https://preview.vercel.app#hash',
        'http://localhost:5173/settings',
    ])('rejects a non-allowlisted or malformed target: %s', baseUrl => {
        expect(() => resolveE2eTarget({ CHIPIN_E2E_BASE_URL: baseUrl })).toThrow();
    });
});

describe('resolveE2eBasicAuth', () => {
    it('returns both staging Basic credentials', () => {
        expect(
            resolveE2eBasicAuth({
                CHIPIN_CONTRACT_SWAGGER_USER: 'e2e-user',
                CHIPIN_CONTRACT_SWAGGER_PASSWORD: 'e2e-password',
            }),
        ).toEqual({ password: 'e2e-password', username: 'e2e-user' });
    });

    it.each([
        {},
        { CHIPIN_CONTRACT_SWAGGER_USER: 'e2e-user' },
        { CHIPIN_CONTRACT_SWAGGER_PASSWORD: 'e2e-password' },
        { CHIPIN_CONTRACT_SWAGGER_USER: ' ', CHIPIN_CONTRACT_SWAGGER_PASSWORD: 'e2e-password' },
        { CHIPIN_CONTRACT_SWAGGER_USER: 'e2e-user', CHIPIN_CONTRACT_SWAGGER_PASSWORD: '' },
    ])('requires both credentials and names them without their values', environment => {
        expect(() => resolveE2eBasicAuth(environment)).toThrow(
            'E2E provisioning requires the staging Basic credentials CHIPIN_CONTRACT_SWAGGER_USER and CHIPIN_CONTRACT_SWAGGER_PASSWORD',
        );
    });
});

describe('resolvePreviewBypass and previewBypassHeaders', () => {
    const preview = 'https://chipin-frontend-fzwunx6is-sylliks-projects.vercel.app';
    const environment = {
        CHIPIN_E2E_BASE_URL: preview,
        VERCEL_AUTOMATION_BYPASS_SECRET: 's3cr3t',
    };
    const bypass = resolvePreviewBypass(environment, resolveE2eTarget(environment));
    const headers = {
        'x-vercel-protection-bypass': 's3cr3t',
        'x-vercel-set-bypass-cookie': 'true',
    };

    it('sends the bypass and set-cookie headers on document navigations to the Preview origin', () => {
        expect(bypass).toEqual({ origin: preview, secret: 's3cr3t' });
        if (!bypass) {
            return;
        }
        for (const url of [`${preview}/`, `${preview}/group/1`, `${preview}/apiary?x=1`]) {
            expect(previewBypassHeaders(bypass, { url, isNavigation: true }), url).toEqual(headers);
        }
    });

    it('never sends them to /api, to subresources or to any other origin', () => {
        if (!bypass) {
            throw new Error('bypass expected');
        }
        expect(
            previewBypassHeaders(bypass, { url: `${preview}/assets/app.js`, isNavigation: false }),
        ).toBeNull();
        for (const url of [
            `${preview}/api`,
            `${preview}/api/groups`,
            `${preview}/api/auth/refresh`,
            'https://api-dev.chipin.one/groups',
            'https://chipin.one/',
            'http://chipin-frontend-fzwunx6is-sylliks-projects.vercel.app/',
            `${preview}:8443/`,
            'https://chipin-frontend-fzwunx6is-sylliks-projects.vercel.app.example.com/',
            'https://accounts.google.com/o/oauth2/auth',
            'not a url',
        ]) {
            expect(previewBypassHeaders(bypass, { url, isNavigation: true }), url).toBeNull();
        }
    });

    it.each([
        { CHIPIN_E2E_BASE_URL: preview },
        { CHIPIN_E2E_BASE_URL: preview, VERCEL_AUTOMATION_BYPASS_SECRET: '  ' },
        { VERCEL_AUTOMATION_BYPASS_SECRET: 's3cr3t' },
        { CHIPIN_E2E_BASE_URL: 'http://localhost:4173', VERCEL_AUTOMATION_BYPASS_SECRET: 's3cr3t' },
    ])('sends nothing without a secret or to a non-Preview target', value => {
        expect(resolvePreviewBypass(value, resolveE2eTarget(value))).toBeNull();
    });
});
