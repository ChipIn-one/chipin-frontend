import type { ContractConfig } from './config';

export type ContractRequestAuth =
    | { kind: 'none' }
    | { kind: 'basic' }
    | { kind: 'bearer'; token: string }
    | { kind: 'session' };

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
const REFRESH_COOKIE_NAME = '__Host-chipin_refresh';
const CSRF_HEADER_VALUE = '1';

const encodeBasicCredentials = (username: string, password: string): string => {
    const bytes = new TextEncoder().encode(`${username}:${password}`);
    let binary = '';

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
};

class ContractRequestError extends Error {}

const redactSensitivePath = (path: string): string =>
    path.replace(
        /^\/users\/invite\/[^/?#]+/,
        '/users/invite/[redacted]',
    );

const describeRequest = (options: ContractRequestOptions): string =>
    `${options.method} ${redactSensitivePath(options.path)}`;

const readRefreshCookie = (response: Response): string | null | undefined => {
    const setCookie = response.headers.get('set-cookie');

    if (!setCookie) {
        return undefined;
    }

    const match = setCookie.match(/(?:^|,\s*)__Host-chipin_refresh=([^;]*)/);

    if (!match) {
        return undefined;
    }

    return match[1] ? `${REFRESH_COOKIE_NAME}=${match[1]}` : null;
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
): ContractHttpClient => {
    let refreshCookie: string | null = null;

    const buildHeaders = (options: ContractRequestOptions): Headers => {
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
            case 'session':
                if (!refreshCookie) {
                    throw new ContractRequestError('Contract refresh cookie is required');
                }

                headers.set('Cookie', refreshCookie);
                headers.set('X-Chipin-Csrf', CSRF_HEADER_VALUE);
                break;
        }

        return headers;
    };

    const performRequest = (options: ContractRequestOptions): Promise<Response> => {
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

            headers = buildHeaders(options);
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
            response => {
                const nextRefreshCookie = readRefreshCookie(response);

                if (nextRefreshCookie !== undefined) {
                    refreshCookie = nextRefreshCookie;
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

    const createSuccessfulRequest = (
        options: ContractRequestOptions,
    ): Promise<Response> => {
        const requestDescription = describeRequest(options);

        return performRequest(options).then(response => {
            if (!response.ok) {
                throw new ContractRequestError(
                    `Contract request ${requestDescription} failed with HTTP ${response.status}`,
                );
            }

            return response;
        });
    };

    return {
        requestText: options => {
            const requestDescription = describeRequest(options);

            return createSuccessfulRequest(options).then(response =>
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

            return createSuccessfulRequest(options).then(response =>
                readJsonResponse(response, requestDescription),
            );
        },
        requestJsonForStatus: (options, expectedStatus) => {
            const requestDescription = describeRequest(options);

            return performRequest(options)
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
    };
};
