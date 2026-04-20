import enActivity from './locales/en/activity.json';
import enApiErrors from './locales/en/apiErrors.json';
import enCommon from './locales/en/common.json';
import enDashboard from './locales/en/dashboard.json';
import enFriends from './locales/en/friends.json';
import enGroup from './locales/en/group.json';
import enLanding from './locales/en/landing.json';
import enSettings from './locales/en/settings.json';
import enToasts from './locales/en/toasts.json';
import ruActivity from './locales/ru/activity.json';
import ruApiErrors from './locales/ru/apiErrors.json';
import ruCommon from './locales/ru/common.json';
import ruDashboard from './locales/ru/dashboard.json';
import ruFriends from './locales/ru/friends.json';
import ruGroup from './locales/ru/group.json';
import ruLanding from './locales/ru/landing.json';
import ruSettings from './locales/ru/settings.json';
import ruToasts from './locales/ru/toasts.json';

export const resources = {
    en: {
        common: enCommon,
        apiErrors: enApiErrors,
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
        apiErrors: ruApiErrors,
        toasts: ruToasts,
        landing: ruLanding,
        activity: ruActivity,
        group: ruGroup,
        dashboard: ruDashboard,
        settings: ruSettings,
        friends: ruFriends,
    },
} as const;
