import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { useTranslation } from 'react-i18next';
import { toast, Toaster } from 'sonner';

import { DEFAULT_LOCALE } from 'constants/locales';
import { canRoleAccessSolo, userSoloModeByDefault } from 'entities/users';
import { resolveBrowserLocale } from 'helpers/locale';
import {
    getPublicLocaleSuggestionTarget,
    isPublicLocaleSuggestionSuppressed,
    suppressPublicLocaleSuggestion,
} from 'helpers/publicLocaleSuggestion';
import { getPreferredModeRoute } from 'helpers/routes';
import { applyLanguage } from 'helpers/setAppLanguage';
import { useCheckPwa } from 'hooks/pwaHooks';
import { updateSeoMetadata } from 'hooks/seoMetadata';
import { useAuthToasts } from 'hooks/useAuthToasts';
import { useScrollToTop } from 'hooks/useScrollToTop';
import { useCanAccessSolo, useSessionSelfLoad, useUserSetting } from 'hooks/useSelfUser';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import type { PublicRoute } from 'types/publicRoutes';

import { PublicSession } from './PublicSession';

const PublicEffects = ({ route, isDark }: { route: PublicRoute; isDark: boolean }) => {
    useAuthToasts();
    useScrollToTop();
    useCheckPwa();

    const { t, i18n } = useTranslation('meta');
    const isAuthResolved = useAuthStore(selectIsAuthResolved);
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    // The public pages run on the anonymous client: a signed-in visitor goes to the app once the
    // session's self load has settled, by the loaded user, else the cached one (spec 03 §1.5).
    const sessionLoad = useSessionSelfLoad();
    const isSessionLoadSettled = sessionLoad.status === 'loaded' || sessionLoad.status === 'failed';
    const cachedSoloModeByDefault = useUserSetting(userSoloModeByDefault);
    const cachedCanAccessSolo = useCanAccessSolo();
    const soloModeByDefault = sessionLoad.user
        ? userSoloModeByDefault(sessionLoad.user.settings)
        : cachedSoloModeByDefault;
    const canAccessSolo = sessionLoad.user
        ? canRoleAccessSolo(sessionLoad.user.role)
        : cachedCanAccessSolo;

    useEffect(() => {
        if (i18n.resolvedLanguage !== route.locale) {
            applyLanguage(route.locale).catch((error: unknown) => {
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
        if (isAuthResolved && isLoggedIn && isSessionLoadSettled && route.page === 'home') {
            // Existing authenticated app routing remains unchanged.
            window.location.replace(getPreferredModeRoute(canAccessSolo && soloModeByDefault));
        }
    }, [
        canAccessSolo,
        isAuthResolved,
        isLoggedIn,
        isSessionLoadSettled,
        route.page,
        soloModeByDefault,
    ]);

    useEffect(() => {
        if (!isAuthResolved || isLoggedIn || route.locale !== DEFAULT_LOCALE) {
            return;
        }
        const suggestedLocale = resolveBrowserLocale();
        if (suggestedLocale === DEFAULT_LOCALE || isPublicLocaleSuggestionSuppressed()) {
            return;
        }
        // The suggested language is a lazy chunk not loaded on this page yet (spec 04 §2.10): only
        // its `toasts` namespace is read, and the toast shows only if that read succeeded and the
        // page is still mounted.
        let cancelled = false;
        const offer = () => {
            if (
                cancelled ||
                isPublicLocaleSuggestionSuppressed() ||
                !i18n.hasResourceBundle(suggestedLocale, 'toasts')
            ) {
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
                        const destination = getPublicLocaleSuggestionTarget(
                            window.location.pathname,
                            suggestedLocale,
                        );
                        if (destination) {
                            window.location.assign(destination);
                        }
                    },
                },
                onDismiss: suppressPublicLocaleSuggestion,
            });
        };

        if (i18n.hasResourceBundle(suggestedLocale, 'toasts')) {
            offer();
        } else {
            i18n.reloadResources([suggestedLocale], ['toasts'])
                .then(() => {
                    // i18next resolves a failed read too; the bundle is then missing.
                    if (!i18n.hasResourceBundle(suggestedLocale, 'toasts')) {
                        throw new Error(`Locale ${suggestedLocale} not loaded: toasts`);
                    }
                    offer();
                })
                .catch((error: unknown) => {
                    Sentry.captureException(error);
                });
        }
        return () => {
            cancelled = true;
        };
    }, [i18n, isAuthResolved, isLoggedIn, route.locale, route.page]);

    return (
        <>
            <PublicSession />
            <Toaster
                theme={isDark ? 'dark' : 'light'}
                richColors
                closeButton
                position="bottom-left"
                offset={16}
                mobileOffset={12}
            />
        </>
    );
};

export { PublicEffects };
