import { API_URLS, ENV_DEV, ENV_PRODUCTION } from 'constants/env';
import type { Environment } from 'constants/env.types';
import { URL_PARAMS } from 'constants/url';

import { getUrlParam } from './url';

export const getEnv = (): Environment => {
    const env = getUrlParam(URL_PARAMS.env);

    if (!env) {
        //TODO: Remove this in production
        return ENV_DEV;
    }

    if (env === ENV_DEV || env === ENV_PRODUCTION) {
        return env;
    }

    return ENV_PRODUCTION;
};

export const getIsProductionEnv = () => {
    return getEnv() === ENV_PRODUCTION;
};

export const getChipInApiUrl = () => API_URLS[getEnv()].baseUrl;
