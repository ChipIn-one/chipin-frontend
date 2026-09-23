import { Buffer } from 'node:buffer';

import type { ContractConfig } from './config';

export type ContractRequestAuth =
    | { kind: 'none' }
    | { kind: 'basic' }
    | { kind: 'bearer'; token: string }
    | { kind: 'refresh'; token: string };

export interface ContractRequestOptions {
    auth: ContractRequestAuth;
    body?: unknown;
    method: 'DELETE' | 'GET' | 'POST';
    path: string;
}

export interface ContractHttpClient {
    requestJson: (options: ContractRequestOptions) => Promise<unknown>;
    requestText: (options: ContractRequestOptions) => Promise<string>;
}

const REQUEST_TIMEOUT_MS = 10_000;

class ContractRequestError extends Error {}

const describeRequest = (options: ContractRequestOptions): string =>
    `${options.method} ${options.path}`;

const buildHeaders = (
    config: ContractConfig,
    options: ContractRequestOptions,
): Headers => {
    const headers = new Headers();

    if (options.body !== undefined) {
        headers.set('Content-Type', 'application/json');
    }

    switch (options.auth.kind) {
        case 'none':
            break;
        case 'basic':
            if (config.basicAuth) {
                const credentials = Buffer.from(
                    `${config.basicAuth.username}:${config.basicAuth.password}`,
                    'utf8',
                ).toString('base64');

                headers.set('Authorization', `Basic ${credentials}`);
            }
            break;
        case 'bearer':
            if (!options.auth.token) {
                throw new ContractRequestError('Contract bearer token is required');
            }

            headers.set('Authorization', `Bearer ${options.auth.token}`);
            break;
        case 'refresh':
            if (!options.auth.token) {
                throw new ContractRequestError('Contract refresh token is required');
            }

            headers.set('X-Refresh-Token', options.auth.token);
            break;
    }

    return headers;
};

const createRequest = (
    config: ContractConfig,
    fetchImpl: typeof fetch,
    options: ContractRequestOptions,
): Promise<Response> => {
    if (!options.path.startsWith('/')) {
        return Promise.reject(
            new ContractRequestError('Contract request path must start with /'),
        );
    }

    let headers: Headers;

    try {
        headers = buildHeaders(config, options);
    } catch (error) {
        return Promise.reject(error);
    }

    const requestDescription = describeRequest(options);

    return fetchImpl(new URL(options.path, config.baseUrl), {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers,
        method: options.method,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).then(
        (response) => {
            if (!response.ok) {
                throw new ContractRequestError(
                    `Contract request ${requestDescription} failed with HTTP ${response.status}`,
                );
            }

            return response;
        },
        () => {
            throw new ContractRequestError(
                `Contract request ${requestDescription} failed`,
            );
        },
    );
};

export const createContractHttpClient = (
    config: ContractConfig,
    fetchImpl: typeof fetch = fetch,
): ContractHttpClient => ({
    requestText: (options) => {
        const requestDescription = describeRequest(options);

        return createRequest(config, fetchImpl, options).then((response) =>
            response.text().then(
                (text) => text,
                () => {
                    throw new ContractRequestError(
                        `Contract request ${requestDescription} failed while reading response`,
                    );
                },
            ),
        );
    },
    requestJson: (options) => {
        const requestDescription = describeRequest(options);

        return createRequest(config, fetchImpl, options).then((response) =>
            response.text().then(
                (text) => {
                    try {
                        return JSON.parse(text);
                    } catch {
                        throw new ContractRequestError(
                            `Contract request ${requestDescription} returned invalid JSON`,
                        );
                    }
                },
                () => {
                    throw new ContractRequestError(
                        `Contract request ${requestDescription} failed while reading response`,
                    );
                },
            ),
        );
    },
});
