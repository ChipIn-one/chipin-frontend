import enApiErrors from './locales/en/apiErrors.json';
import enCommon from './locales/en/common.json';
import ruApiErrors from './locales/ru/apiErrors.json';
import ruCommon from './locales/ru/common.json';

export const resources = {
    en: {
        common: enCommon,
        apiErrors: enApiErrors,
    },
    ru: {
        common: ruCommon,
        apiErrors: ruApiErrors,
    },
} as const;
