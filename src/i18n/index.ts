import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resolveLocale } from 'helpers/locale';
import { getPublicRoute } from 'constants/publicRoutes';

import { resources } from './resources';

i18n.use(initReactI18next).init({
    resources,
    lng: (typeof window !== 'undefined' && getPublicRoute(window.location.pathname)?.locale) || resolveLocale(),
    fallbackLng: 'en',

    ns: [
        'common',
        'auth',
        'errors',
        'currencies',
        'toasts',
        'landing',
        'activity',
        'group',
        'dashboard',
        'settings',
        'friends',
        'skeletons',
        'meta',
    ],
    defaultNS: 'common',

    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
