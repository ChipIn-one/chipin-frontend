export const ENV_DEV = 'dev' as const;
export const ENV_PRODUCTION = 'prod' as const;

export const API_URLS = {
    [ENV_PRODUCTION]: {
        baseUrl: 'https://api.chipin.one/',
    },
    [ENV_DEV]: {
        baseUrl: 'https://api-dev.chipin.one/',
    },
};
