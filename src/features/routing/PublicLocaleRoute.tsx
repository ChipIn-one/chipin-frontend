import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import * as Sentry from '@sentry/react';

import { matchLocale } from 'helpers/locale';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectUserSettings, useUsersStore } from 'store/users-store';
import type { PublicLocale } from 'types/publicRoutes';

import PageLoader from 'basics/PageLoader';

// SPA navigation can reach public URLs without reloading their SSG document.
// Align each page with its URL; restore the authenticated user's preference
// when returning to the private application.
const PublicLocaleRoute = ({
    locale,
    children,
}: {
    locale: PublicLocale;
    children: ReactNode;
}) => {
    const { i18n } = useTranslation();
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const savedLanguage = useUsersStore(selectUserSettings)?.language;
    const resolvedLanguage = i18n.resolvedLanguage;
    const isLoggedInRef = useRef(isLoggedIn);
    const savedLanguageRef = useRef(savedLanguage);
    const previousDocumentLanguageRef = useRef<string | null>(null);

    useEffect(() => {
        isLoggedInRef.current = isLoggedIn;
        savedLanguageRef.current = savedLanguage;
    }, [isLoggedIn, savedLanguage]);

    // Re-asserts the URL language whenever anything else (for example user
    // settings synchronization) switches i18n away from it.
    useEffect(() => {
        if (previousDocumentLanguageRef.current === null) {
            previousDocumentLanguageRef.current = document.documentElement.lang;
        }

        document.documentElement.lang = locale;
        if (resolvedLanguage !== locale) {
            i18n.changeLanguage(locale).catch((error: unknown) => {
                Sentry.captureException(error);
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
            document.documentElement.lang =
                userLocale ?? previousDocumentLanguageRef.current ?? document.documentElement.lang;
            if (userLocale && i18n.resolvedLanguage !== userLocale) {
                i18n.changeLanguage(userLocale).catch((error: unknown) => {
                    Sentry.captureException(error);
                });
            }
        };
    }, [i18n]);

    if (resolvedLanguage !== locale) {
        return <PageLoader />;
    }
    return children;
};

export { PublicLocaleRoute };
