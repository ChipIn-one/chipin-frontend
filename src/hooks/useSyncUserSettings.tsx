import { useEffect } from 'react';
import { useTheme } from 'next-themes';

import { matchLocale, onChangeLocale } from 'helpers/locale';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectUserSettings, useUsersStore } from 'store/users-store';

export const useSyncUserSettings = () => {
    const authStatus = useAuthStore(selectAuthStatus);
    const settings = useUsersStore(selectUserSettings);
    const { setTheme } = useTheme();

    useEffect(() => {
        if (!settings) {
            return;
        }

        if (authStatus === 'authenticated') {
            setTheme(settings.theme);
        }

        const locale = matchLocale(settings.language);

        if (locale) {
            onChangeLocale(locale);
        }
    }, [authStatus, settings, setTheme]);
};
