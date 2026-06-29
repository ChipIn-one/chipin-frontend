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
import enSkeletons from './locales/en/skeletons.json';
import enToasts from './locales/en/toasts.json';
import esActivity from './locales/es/activity.json';
import esAuth from './locales/es/auth.json';
import esCommon from './locales/es/common.json';
import esCurrencies from './locales/es/currencies.json';
import esDashboard from './locales/es/dashboard.json';
import esErrors from './locales/es/errors.json';
import esFriends from './locales/es/friends.json';
import esGroup from './locales/es/group.json';
import esLanding from './locales/es/landing.json';
import esSettings from './locales/es/settings.json';
import esSkeletons from './locales/es/skeletons.json';
import esTranslations from './locales/es/toasts.json';
import ptBrActivity from './locales/pt-BR/activity.json';
import ptBrAuth from './locales/pt-BR/auth.json';
import ptBrCommon from './locales/pt-BR/common.json';
import ptBrCurrencies from './locales/pt-BR/currencies.json';
import ptBrDashboard from './locales/pt-BR/dashboard.json';
import ptBrErrors from './locales/pt-BR/errors.json';
import ptBrFriends from './locales/pt-BR/friends.json';
import ptBrGroup from './locales/pt-BR/group.json';
import ptBrLanding from './locales/pt-BR/landing.json';
import ptBrSettings from './locales/pt-BR/settings.json';
import ptBrSkeletons from './locales/pt-BR/skeletons.json';
import ptBrToasts from './locales/pt-BR/toasts.json';
import ptPtActivity from './locales/pt-PT/activity.json';
import ptPtAuth from './locales/pt-PT/auth.json';
import ptPtCommon from './locales/pt-PT/common.json';
import ptPtCurrencies from './locales/pt-PT/currencies.json';
import ptPtDashboard from './locales/pt-PT/dashboard.json';
import ptPtErrors from './locales/pt-PT/errors.json';
import ptPtFriends from './locales/pt-PT/friends.json';
import ptPtGroup from './locales/pt-PT/group.json';
import ptPtLanding from './locales/pt-PT/landing.json';
import ptPtSettings from './locales/pt-PT/settings.json';
import ptPtSkeletons from './locales/pt-PT/skeletons.json';
import ptPtToasts from './locales/pt-PT/toasts.json';
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
import ruSkeletons from './locales/ru/skeletons.json';
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
        skeletons: enSkeletons,
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
        skeletons: ruSkeletons,
    },
    es: {
        common: esCommon,
        auth: esAuth,
        errors: esErrors,
        currencies: esCurrencies,
        toasts: esTranslations,
        landing: esLanding,
        activity: esActivity,
        group: esGroup,
        dashboard: esDashboard,
        settings: esSettings,
        friends: esFriends,
        skeletons: esSkeletons,
    },
    'pt-BR': {
        common: ptBrCommon,
        auth: ptBrAuth,
        errors: ptBrErrors,
        currencies: ptBrCurrencies,
        toasts: ptBrToasts,
        landing: ptBrLanding,
        activity: ptBrActivity,
        group: ptBrGroup,
        dashboard: ptBrDashboard,
        settings: ptBrSettings,
        friends: ptBrFriends,
        skeletons: ptBrSkeletons,
    },
    'pt-PT': {
        common: ptPtCommon,
        auth: ptPtAuth,
        errors: ptPtErrors,
        currencies: ptPtCurrencies,
        toasts: ptPtToasts,
        landing: ptPtLanding,
        activity: ptPtActivity,
        group: ptPtGroup,
        dashboard: ptPtDashboard,
        settings: ptPtSettings,
        friends: ptPtFriends,
        skeletons: ptPtSkeletons,
    },
} as const;
