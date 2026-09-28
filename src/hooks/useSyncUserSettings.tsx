import { useEffect } from 'react';
import { useTheme } from 'next-themes';

import * as Sentry from '@sentry/react';

import { matchLocale, saveLocalePreference } from 'helpers/locale';
import i18n from 'i18n';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectUserSettings, useUsersStore } from 'store/users-store';

export const useSyncUserSettings = () => {
    const authStatus = useAuthStore(selectAuthStatus);
    const settings = useUsersStore(selectUserSettings);
    const { setTheme } = useTheme();

    useEffect(() => {
        if (!settings || authStatus !== 'authenticated') {
            return;
        }

        setTheme(settings.theme);

        const locale = matchLocale(settings.language);

        if (locale) {
            saveLocalePreference(locale);
            i18n.changeLanguage(locale).catch(error => {
                Sentry.captureException(error);
            });
        }
    }, [authStatus, settings, setTheme]);
};
