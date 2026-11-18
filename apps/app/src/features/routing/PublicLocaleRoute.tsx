import { type ReactNode, useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import { useTranslation } from 'react-i18next';

import type { SelfUserSettings } from 'entities/users';
import { matchLocale } from 'helpers/locale';
import { applyLanguage } from 'helpers/setAppLanguage';
import { useUserSetting } from 'hooks/useSelfUser';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import type { PublicLocale } from 'types/publicRoutes';

import PageLoader from 'basics/PageLoader';

const pickLanguage = (settings: SelfUserSettings | null) => settings?.language;

// SPA navigation can reach public URLs without reloading their SSG document.
// Align each page with its URL; restore the authenticated user's preference
// when returning to the private application.
const PublicLocaleRoute = ({ locale, children }: { locale: PublicLocale; children: ReactNode }) => {
    const { i18n } = useTranslation();
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const savedLanguage = useUserSetting(pickLanguage);
    const resolvedLanguage = i18n.resolvedLanguage;
    // The URL language whose chunks failed to load (spec 04 §2.10): the page renders in the
    // active language instead of a loader that never ends.
    const [failedLocale, setFailedLocale] = useState<PublicLocale | null>(null);
    const isLoggedInRef = useRef(isLoggedIn);
    const savedLanguageRef = useRef(savedLanguage);

    useEffect(() => {
        isLoggedInRef.current = isLoggedIn;
        savedLanguageRef.current = savedLanguage;
    }, [isLoggedIn, savedLanguage]);

    // Re-asserts the URL language whenever anything else (for example user
    // settings synchronization) switches i18n away from it.
    // `<html lang>` follows i18next (`i18n/htmlLang`, wired at boot): no write of it here (#708).
    useEffect(() => {
        if (resolvedLanguage !== locale) {
            applyLanguage(locale).catch((error: unknown) => {
                Sentry.captureException(error);
                setFailedLocale(locale);
            });
        }
    }, [i18n, locale, resolvedLanguage]);

    // Restores the user's language only when leaving public pages; a locale
    // change between public pages reuses this instance and must not race.
    useEffect(() => {
        return () => {
            const userLocale = isLoggedInRef.current
                ? matchLocale(savedLanguageRef.current ?? '')
                : null;
            if (userLocale && i18n.resolvedLanguage !== userLocale) {
                applyLanguage(userLocale).catch((error: unknown) => {
                    Sentry.captureException(error);
                });
            }
        };
    }, [i18n]);

    if (resolvedLanguage !== locale && failedLocale !== locale) {
        return <PageLoader />;
    }
    return children;
};

export { PublicLocaleRoute };
