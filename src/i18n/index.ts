import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { STORAGE_LOCALE_KEY } from 'constants/localstorage';
import { storage } from 'helpers/localStorage';

import { resources } from './resources';

i18n.use(initReactI18next).init({
    resources,
    lng: storage.get(STORAGE_LOCALE_KEY, 'en'),
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
    ],
    defaultNS: 'common',

    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
