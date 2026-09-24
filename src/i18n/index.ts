import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resolveLocale } from 'helpers/locale';

import { resources } from './resources';

i18n.use(initReactI18next).init({
    resources,
    lng: resolveLocale(),
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
