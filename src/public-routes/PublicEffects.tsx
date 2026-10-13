import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import * as Sentry from '@sentry/react';

import { LS_KEY_LOCALE } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';
import { getPreferredModeRoute } from 'helpers/routes';
import { getRootLocaleRedirect, selectRootLocale } from 'helpers/publicRoutes';
import { useCheckOnlineStatus, useCheckPwa } from 'hooks/pwaHooks';
import { updateSeoMetadata } from 'hooks/seoMetadata';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
import type { PublicRoute } from 'types/publicRoutes';

import { useConnect } from './internal/useConnect';

const PublicEffects = ({ route }: { route: PublicRoute }) => {
    useCheckSignIn();
    useCheckPwa();
    useCheckOnlineStatus();

    const { t, i18n } = useTranslation('meta');
    const { isAuthResolved, isLoggedIn, isUserFetched, settings, canAccessSolo } = useConnect();

    useEffect(() => {
        if (i18n.resolvedLanguage !== route.locale) {
            i18n.changeLanguage(route.locale).catch((error: unknown) => {
                Sentry.captureException(error);
            });
        }
    }, [i18n, route.locale]);

    useEffect(() => {
        const title = t(route.metaKey + '.title');
        const description = t(route.metaKey + '.description');
        document.title = title;
        let descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (!descriptionTag) {
            descriptionTag = document.createElement('meta');
            descriptionTag.name = 'description';
            document.head.appendChild(descriptionTag);
        }
        descriptionTag.content = description;
        updateSeoMetadata(route.path, title, description);
    }, [i18n.resolvedLanguage, route.metaKey, route.path, t]);

    useEffect(() => {
        if (!isAuthResolved || route.page !== 'home') return;
        if (isLoggedIn) {
            if (isUserFetched) {
                window.location.replace(
                    getPreferredModeRoute(canAccessSolo && (settings?.soloModeByDefault ?? false)),
                );
            }
            return;
        }
        // Locale preference navigation is client-only and applies solely to anonymous exact root.
        if (window.location.pathname !== '/') return;
        const params = new URLSearchParams(window.location.search);
        const stored = LocalStorage.get(LS_KEY_LOCALE, '');
        const browserLanguages = navigator.languages?.length
            ? navigator.languages
            : [navigator.language];
        const locale = selectRootLocale(params.get('lang'), stored || null, browserLanguages);
        const destination = getRootLocaleRedirect(
            locale, window.location.search, window.location.hash,
        );
        if (destination) window.location.replace(destination);
    }, [
        canAccessSolo, isAuthResolved, isLoggedIn, isUserFetched,
        route.locale, route.page, settings?.soloModeByDefault,
    ]);
    return null;
};

export { PublicEffects };
