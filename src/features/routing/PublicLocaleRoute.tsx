import { useEffect, type ReactNode } from 'react';
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

    useEffect(() => {
        if (i18n.resolvedLanguage !== locale) {
            i18n.changeLanguage(locale).catch((error: unknown) => {
                Sentry.captureException(error);
            });
        }

        return () => {
            if (!isLoggedIn) {
                return;
            }
            const userLocale = matchLocale(savedLanguage ?? '');
            if (userLocale && i18n.resolvedLanguage !== userLocale) {
                i18n.changeLanguage(userLocale).catch((error: unknown) => {
                    Sentry.captureException(error);
                });
            }
        };
    }, [i18n, isLoggedIn, locale, savedLanguage]);

    if (i18n.resolvedLanguage !== locale) {
        return <PageLoader />;
    }
    return children;
};

export { PublicLocaleRoute };
