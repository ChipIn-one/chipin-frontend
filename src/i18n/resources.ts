import enActivity from './locales/en/activity.json';
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enCurrencies from './locales/en/currencies.json';
import enDashboard from './locales/en/dashboard.json';
import enErrors from './locales/en/errors.json';
import enFriends from './locales/en/friends.json';
import enGroup from './locales/en/group.json';
import enLanding from './locales/en/landing.json';
import enSettings from './locales/en/settings.json';
import enToasts from './locales/en/toasts.json';
import ruActivity from './locales/ru/activity.json';
import ruAuth from './locales/ru/auth.json';
import ruCommon from './locales/ru/common.json';
import ruCurrencies from './locales/ru/currencies.json';
import ruDashboard from './locales/ru/dashboard.json';
import ruErrors from './locales/ru/errors.json';
import ruFriends from './locales/ru/friends.json';
import ruGroup from './locales/ru/group.json';
import ruLanding from './locales/ru/landing.json';
import ruSettings from './locales/ru/settings.json';
import ruToasts from './locales/ru/toasts.json';

export const resources = {
    en: {
        common: enCommon,
        auth: enAuth,
        errors: enErrors,
        currencies: enCurrencies,
        toasts: enToasts,
        landing: enLanding,
        activity: enActivity,
        group: enGroup,
        dashboard: enDashboard,
        settings: enSettings,
        friends: enFriends,
    },
    ru: {
        common: ruCommon,
        auth: ruAuth,
        errors: ruErrors,
        currencies: ruCurrencies,
        toasts: ruToasts,
        landing: ruLanding,
        activity: ruActivity,
        group: ruGroup,
        dashboard: ruDashboard,
        settings: ruSettings,
        friends: ruFriends,
    },
} as const;
