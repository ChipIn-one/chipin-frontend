import { useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import * as Sentry from '@sentry/react';

import { DEFAULT_LOCALE } from 'constants/locales';
import { resolveBrowserLocale } from 'helpers/locale';
import { isPublicLocaleSuggestionSuppressed, suppressPublicLocaleSuggestion } from 'helpers/publicLocaleSuggestion';
import { getPreferredModeRoute } from 'helpers/routes';
import { getPublicPath } from 'helpers/publicRoutes';
import { useCheckOnlineStatus, useCheckPwa } from 'hooks/pwaHooks';
import { useAuthToasts } from 'hooks/useAuthToasts';
import { updateSeoMetadata } from 'hooks/seoMetadata';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
import { useScrollToTop } from 'hooks/useScrollToTop';
import type { PublicRoute } from 'types/publicRoutes';

import { useConnect } from './internal/useConnect';

const PublicEffects = ({ route }: { route: PublicRoute }) => {
    useCheckSignIn();
    useAuthToasts();
    useScrollToTop();
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
        if (isAuthResolved && isLoggedIn && isUserFetched && route.page === 'home') {
            // Existing authenticated app routing remains unchanged.
            window.location.replace(
                getPreferredModeRoute(canAccessSolo && (settings?.soloModeByDefault ?? false)),
            );
        }
    }, [canAccessSolo, isAuthResolved, isLoggedIn, isUserFetched, route.page, settings?.soloModeByDefault]);

    useEffect(() => {
        if (!isAuthResolved || isLoggedIn || route.locale !== DEFAULT_LOCALE) {
            return;
        }
        const suggestedLocale = resolveBrowserLocale();
        if (suggestedLocale === DEFAULT_LOCALE || isPublicLocaleSuggestionSuppressed()) {
            return;
        }
        // Suppress before emitting: revisiting any English page must never re-offer.
        suppressPublicLocaleSuggestion();
        const translate = i18n.getFixedT(suggestedLocale, 'toasts');
        toast.message(translate('public.languageSuggestion'), {
            id: 'public-locale-suggestion',
            duration: Infinity,
            dismissible: true,
            action: {
                label: translate('public.languageSuggestionAction'),
                onClick: () => {
                    suppressPublicLocaleSuggestion();
                    window.location.assign(getPublicPath(route.page, suggestedLocale));
                },
            },
            onDismiss: suppressPublicLocaleSuggestion,
        });
    }, [i18n, isAuthResolved, isLoggedIn, route.locale, route.page]);

    return null;
};

export { PublicEffects };
