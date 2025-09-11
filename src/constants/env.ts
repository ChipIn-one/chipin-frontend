export const ENV_DEV = 'dev' as const;
export const ENV_PROD = 'prod' as const;

export const API_URLS = {
    [ENV_PROD]: {
        baseUrl: 'https://api.chipin.one/',
        hostname: 'chipin.one',
    },
    [ENV_DEV]: {
        baseUrl: 'https://api-dev.chipin.one/',
        hostname: 'dev.chipin.one',
    },
};
