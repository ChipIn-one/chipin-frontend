import { useEffect } from 'react';
import { useTheme } from 'next-themes';

import { matchLocale, onChangeLocale } from 'helpers/locale';
import { selectUserSettings } from 'store/usersSelectors';
import { useUsersStore } from 'store/usersStore';

export const useSyncUserSettings = () => {
    const settings = useUsersStore(selectUserSettings);
    const { setTheme } = useTheme();

    useEffect(() => {
        if (!settings) {
            return;
        }

        setTheme(settings.theme);

        const locale = matchLocale(settings.language);

        if (locale) {
            onChangeLocale(locale);
        }
    }, [settings, setTheme]);
};
