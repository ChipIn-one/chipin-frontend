export interface ContractEnvironment {
    CHIPIN_CONTRACT_BASE_URL?: string;
    CHIPIN_CONTRACT_BASIC_USER?: string;
    CHIPIN_CONTRACT_BASIC_PASSWORD?: string;
}

export interface ContractBasicAuth {
    username: string;
    password: string;
}

export interface ContractConfig {
    baseUrl: string;
    basicAuth: ContractBasicAuth | null;
    target: 'local' | 'staging';
}

const STAGING_ORIGIN = 'https://api-dev.chipin.one';
const PRODUCTION_ORIGIN = 'https://api.chipin.one';
const LOCAL_ORIGINS = new Set(['http://localhost:8080', 'http://127.0.0.1:8080']);

const parseTargetUrl = (value: string): URL => {
    try {
        return new URL(value);
    } catch {
        throw new Error('Contract target must be an absolute URL');
    }
};

export const resolveContractConfig = (environment: ContractEnvironment): ContractConfig => {
    const rawBaseUrl = environment.CHIPIN_CONTRACT_BASE_URL?.trim();

    if (!rawBaseUrl) {
        throw new Error('Contract target is required');
    }

    const targetUrl = parseTargetUrl(rawBaseUrl);

    if (targetUrl.origin === PRODUCTION_ORIGIN) {
        throw new Error('Production contract target is forbidden');
    }

    if (targetUrl.username || targetUrl.password) {
        throw new Error('Contract target must not contain user info');
    }

    if (targetUrl.search || targetUrl.hash) {
        throw new Error('Contract target must not contain query or fragment');
    }

    if (targetUrl.pathname !== '/') {
        throw new Error('Contract target must use the origin root');
    }

    const isStaging = targetUrl.origin === STAGING_ORIGIN;
    const isLocal = LOCAL_ORIGINS.has(targetUrl.origin);

    if (!isStaging && !isLocal) {
        throw new Error('Contract target is not allowlisted');
    }

    if (isLocal) {
        return {
            baseUrl: targetUrl.origin,
            basicAuth: null,
            target: 'local',
        };
    }

    const username = environment.CHIPIN_CONTRACT_BASIC_USER;
    const password = environment.CHIPIN_CONTRACT_BASIC_PASSWORD;

    if (!username?.trim() || !password?.trim()) {
        throw new Error('Staging contract tests require Basic credentials');
    }

    return {
        baseUrl: targetUrl.origin,
        basicAuth: {
            password,
            username,
        },
        target: 'staging',
    };
};
