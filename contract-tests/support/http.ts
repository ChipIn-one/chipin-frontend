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
    requestJsonForStatus: (
        options: ContractRequestOptions,
        expectedStatus: number,
    ) => Promise<unknown>;
    requestText: (options: ContractRequestOptions) => Promise<string>;
}

const REQUEST_TIMEOUT_MS = 10_000;

const encodeBasicCredentials = (username: string, password: string): string => {
    const bytes = new TextEncoder().encode(`${username}:${password}`);
    let binary = '';

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
};

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
                const credentials = encodeBasicCredentials(
                    config.basicAuth.username,
                    config.basicAuth.password,
                );

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

const performRequest = (
    config: ContractConfig,
    fetchImpl: typeof fetch,
    options: ContractRequestOptions,
): Promise<Response> => {
    if (!options.path.startsWith('/')) {
        return Promise.reject(
            new ContractRequestError('Contract request path must start with /'),
        );
    }

    let requestUrl: URL;
    let headers: Headers;

    try {
        requestUrl = new URL(options.path, config.baseUrl);

        if (requestUrl.origin !== new URL(config.baseUrl).origin) {
            throw new ContractRequestError(
                'Contract request path must stay on the configured origin',
            );
        }

        headers = buildHeaders(config, options);
    } catch (error) {
        return Promise.reject(error);
    }

    const requestDescription = describeRequest(options);

    return fetchImpl(requestUrl, {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers,
        method: options.method,
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).then(
        response => response,
        () => {
            throw new ContractRequestError(
                `Contract request ${requestDescription} failed`,
            );
        },
    );
};

const createSuccessfulRequest = (
    config: ContractConfig,
    fetchImpl: typeof fetch,
    options: ContractRequestOptions,
): Promise<Response> => {
    const requestDescription = describeRequest(options);

    return performRequest(config, fetchImpl, options).then(response => {
        if (!response.ok) {
            throw new ContractRequestError(
                `Contract request ${requestDescription} failed with HTTP ${response.status}`,
            );
        }

        return response;
    });
};

const readJsonResponse = (
    response: Response,
    requestDescription: string,
): Promise<unknown> => {
    return response.text().then(
        text => {
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
    );
};

export const createContractHttpClient = (
    config: ContractConfig,
    fetchImpl: typeof fetch = fetch,
): ContractHttpClient => ({
    requestText: options => {
        const requestDescription = describeRequest(options);

        return createSuccessfulRequest(config, fetchImpl, options).then(response =>
            response.text().then(
                text => text,
                () => {
                    throw new ContractRequestError(
                        `Contract request ${requestDescription} failed while reading response`,
                    );
                },
            ),
        );
    },
    requestJson: options => {
        const requestDescription = describeRequest(options);

        return createSuccessfulRequest(config, fetchImpl, options).then(response =>
            readJsonResponse(response, requestDescription),
        );
    },
    requestJsonForStatus: (options, expectedStatus) => {
        const requestDescription = describeRequest(options);

        return performRequest(config, fetchImpl, options)
            .then(response => {
                if (response.status !== expectedStatus) {
                    throw new ContractRequestError(
                        `Contract request ${requestDescription} expected HTTP ${expectedStatus} but received HTTP ${response.status}`,
                    );
                }

                return response;
            })
            .then(response => readJsonResponse(response, requestDescription));
    },
});
