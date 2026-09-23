import { randomUUID } from 'node:crypto';

import { it } from 'vitest';

import { resolveContractConfig } from './support/config';
import {
    parseRefreshResponse,
    parseRegisterResponse,
    parseSelfUserResponse,
} from './support/guards';
import { createContractHttpClient } from './support/http';

const REQUIRED_OPENAPI_PATHS = [
    '/auth/test-register',
    '/auth/refresh',
    '/users/self',
] as const;

const createRunId = (): string => `fe-${Date.now()}-${randomUUID()}`;

const assertOpenApiPaths = (document: string): void => {
    if (!document.trim()) {
        throw new Error('Runtime OpenAPI document is empty');
    }

    for (const path of REQUIRED_OPENAPI_PATHS) {
        if (!document.includes(path)) {
            throw new Error(`Runtime OpenAPI is missing required path ${path}`);
        }
    }
};

it('validates the live auth and session contract', () => {
    const config = resolveContractConfig({
        CHIPIN_CONTRACT_BASE_URL: process.env.CHIPIN_CONTRACT_BASE_URL,
        CHIPIN_CONTRACT_BASIC_USER: process.env.CHIPIN_CONTRACT_BASIC_USER,
        CHIPIN_CONTRACT_BASIC_PASSWORD: process.env.CHIPIN_CONTRACT_BASIC_PASSWORD,
    });
    const client = createContractHttpClient(config);
    const runId = createRunId();
    let provisionAttempted = false;
    let provisionedUser: ReturnType<typeof parseRegisterResponse> | null = null;

    return client
        .requestText({
            auth: { kind: 'basic' },
            method: 'GET',
            path: '/swagger/documentation.yaml',
        })
        .then((document) => {
            assertOpenApiPaths(document);
            provisionAttempted = true;

            return client.requestJson({
                auth: { kind: 'basic' },
                body: {
                    displayName: 'FE Contract User',
                    runId,
                },
                method: 'POST',
                path: '/auth/test-register',
            });
        })
        .then((value) => {
            const registerResponse = parseRegisterResponse(value);

            if (registerResponse.runId !== runId) {
                throw new Error('Provisioning response runId does not match the requested run');
            }

            provisionedUser = registerResponse;

            return client.requestJson({
                auth: {
                    kind: 'bearer',
                    token: registerResponse.accessToken,
                },
                method: 'GET',
                path: '/users/self',
            });
        })
        .then((value) => {
            const selfUser = parseSelfUserResponse(value);

            if (!provisionedUser) {
                throw new Error('Provisioning state is unavailable');
            }

            if (
                selfUser.id !== provisionedUser.user.id ||
                selfUser.email !== provisionedUser.user.email ||
                selfUser.displayName !== provisionedUser.user.displayName
            ) {
                throw new Error('Authenticated self user does not match the provisioned user');
            }

            return client.requestJson({
                auth: {
                    kind: 'refresh',
                    token: provisionedUser.refreshToken,
                },
                method: 'POST',
                path: '/auth/refresh',
            });
        })
        .then((value) => {
            parseRefreshResponse(value);
        })
        .finally(() => {
            if (!provisionAttempted) {
                return undefined;
            }

            return client
                .requestJson({
                    auth: { kind: 'basic' },
                    method: 'DELETE',
                    path: `/auth/test-runs/${encodeURIComponent(runId)}`,
                })
                .then(() => undefined);
        });
});
