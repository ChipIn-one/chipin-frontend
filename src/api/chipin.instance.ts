import axios from 'axios';

import { getChipInApiUrl } from 'helpers/env';

export const apiInstance = axios.create({
    baseURL: getChipInApiUrl(),
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
});

export const publicApiInstance = axios.create({
    baseURL: getChipInApiUrl(),
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
});
