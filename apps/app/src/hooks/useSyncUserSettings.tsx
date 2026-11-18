import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { useTheme } from 'next-themes';

import type { SelfUserSettings } from 'entities/users';
import { matchLocale, saveLocalePreference } from 'helpers/locale';
import { getPendingLanguage, setAppLanguage } from 'helpers/setAppLanguage';
import { i18n } from 'i18n';
import { AUTH_STATUS } from 'store/authConstants';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import { useUserSetting } from './useSelfUser';

// Primitives from `select` (spec 03 §6 row 3): each effect runs when its own value changes, not on
// every new settings object.
const pickTheme = (settings: SelfUserSettings | null) => settings?.theme ?? null;
const pickLanguage = (settings: SelfUserSettings | null) => settings?.language ?? null;

export const useSyncUserSettings = () => {
    const isAuthenticated = useAuthStore(selectAuthStatus) === AUTH_STATUS.AUTHENTICATED;
    const theme = useUserSetting(pickTheme);
    const language = useUserSetting(pickLanguage);
    const { setTheme } = useTheme();

    useEffect(() => {
        if (theme !== null && isAuthenticated) {
            setTheme(theme);
        }
    }, [isAuthenticated, theme, setTheme]);

    useEffect(() => {
        if (language === null || !isAuthenticated) {
            return;
        }

        const locale = matchLocale(language);

        if (!locale) {
            return;
        }
        // Spec 04 §2.10: switch only when the server language differs from the current one (the
        // target of a switch in flight, else the active one); the preference is saved either way,
        // as before.
        if (locale === (getPendingLanguage() ?? i18n.resolvedLanguage)) {
            saveLocalePreference(locale);
            return;
        }
        setAppLanguage(locale).catch((error: unknown) => {
            Sentry.captureException(error);
        });
    }, [isAuthenticated, language]);
};
