export const ENV_DEV = 'dev' as const;
export const ENV_PROD = 'prod' as const;
export const API_BASE_PATH = '/api/' as const;

export const ENV_URLS = {
    [ENV_PROD]: {
        siteBaseUrl: 'https://chipin.one/',
        hostname: 'chipin.one',
    },
    [ENV_DEV]: {
        siteBaseUrl: 'https://dev.chipin.one/',
        hostname: 'dev.chipin.one',
    },
};
