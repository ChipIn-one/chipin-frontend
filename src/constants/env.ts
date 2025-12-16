export const ENV_DEV = 'dev' as const;
export const ENV_PROD = 'prod' as const;

export const ENV_URLS = {
    [ENV_PROD]: {
        apiBaseUrl: 'https://api.chipin.one/',
        siteBaseUrl: 'https://chipin.one/',
        hostname: 'chipin.one',
    },
    [ENV_DEV]: {
        apiBaseUrl: 'https://api-dev.chipin.one/',
        siteBaseUrl: 'https://dev.chipin.one/',
        hostname: 'dev.chipin.one',
    },
};
