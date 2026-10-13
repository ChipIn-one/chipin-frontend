import { useEffect } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { BrowserRouter, MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import type { i18n as I18nInstance } from 'i18next';

import { Box, Flex, Link, Theme } from '@radix-ui/themes';

import {
    getPublicPath,
    getPublicRoute,
    getRootLocaleRedirect,
    PUBLIC_ROUTE_ENTRIES,
    selectRootLocale,
    type PublicRoute,
} from 'constants/publicRoutes';
import { LS_KEY_LOCALE } from 'constants/localstorage';
import { lightThemeStyled } from 'constants/styled-themes';
import { LocalStorage } from 'helpers/localStorage';
import { getPreferredModeRoute } from 'helpers/routes';
import { useCheckPwa } from 'hooks/pwaHooks';
import { updateSeoMetadata } from 'hooks/seoMetadata';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectUserSelfFetched } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectCanAccessSolo, selectUserSettings, useUsersStore } from 'store/users-store';

import BackgroundBox from 'basics/BackgroundBox';
import Header from 'components/Header';
import { ModalOverlayGlobalStyles } from 'components/modals/components';
import HomePage from 'pages/HomePage';
import PrivacyPage from 'pages/PrivacyPage';
import TermsPage from 'pages/TermsPage';

const LANGUAGE_NAMES = {
    en: 'English',
    ru: 'Русский',
    es: 'Español',
    'pt-BR': 'Português (Brasil)',
    'pt-PT': 'Português (Portugal)',
} as const;

const PublicEffects = ({ route }: { route: PublicRoute }) => {
    useCheckSignIn();
    useCheckPwa();

    const { t, i18n } = useTranslation('meta');
    const isAuthResolved = useAuthStore(selectIsAuthResolved);
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const isUserFetched = useLoadingStore(selectUserSelfFetched);
    const settings = useUsersStore(selectUserSettings);
    const canAccessSolo = useUsersStore(selectCanAccessSolo);

    useEffect(() => {
        if (i18n.resolvedLanguage !== route.locale) {
            i18n.changeLanguage(route.locale).catch(() => undefined);
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
        if (!isAuthResolved || route.page !== 'home' || route.locale !== 'en') {
            return;
        }
        if (isLoggedIn) {
            if (isUserFetched) {
                window.location.replace(
                    getPreferredModeRoute(canAccessSolo && (settings?.soloModeByDefault ?? false)),
                );
            }
            return;
        }

        // The root response stays English and indexable; only the anonymous
        // hydrated browser is eligible for locale preference navigation.
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

const PublicContent = ({ initialRoute }: { initialRoute: PublicRoute }) => {
    const location = useLocation();
    const route = getPublicRoute(location.pathname) ?? initialRoute;

    useEffect(() => {
        if (!getPublicRoute(location.pathname)) {
            window.location.assign(location.pathname + location.search + location.hash);
        }
    }, [location.hash, location.pathname, location.search]);

    let Page = HomePage;
    if (route.page === 'privacy') {
        Page = PrivacyPage;
    } else if (route.page === 'terms') {
        Page = TermsPage;
    }

    return (
        <BackgroundBox>
            <PublicEffects route={route} />
            <Header />
            <Flex px="4" pt="2" gap="3" align="center" wrap="wrap" justify="center">
                {PUBLIC_ROUTE_ENTRIES
                    .filter(item => item.page === route.page)
                    .map(item => (
                        <Link
                            href={getPublicPath(item.page, item.locale)}
                            key={item.locale}
                            lang={item.locale}
                            size="2"
                            underline={item.locale === route.locale ? 'always' : 'hover'}
                            aria-current={item.locale === route.locale ? 'page' : undefined}
                        >
                            {LANGUAGE_NAMES[item.locale]}
                        </Link>
                    ))}
            </Flex>
            <Box px="4"><Page /></Box>
        </BackgroundBox>
    );
};

interface PublicAppProps {
    route: PublicRoute;
    i18nInstance: I18nInstance;
    server?: boolean;
}

const PublicApp = ({ route, i18nInstance, server = false }: PublicAppProps) => {
    const routerContent = server ? (
        <MemoryRouter initialEntries={[route.path]}>
            <PublicContent initialRoute={route} />
        </MemoryRouter>
    ) : (
        <BrowserRouter>
            <PublicContent initialRoute={route} />
        </BrowserRouter>
    );

    return (
        <I18nextProvider i18n={i18nInstance}>
            <ThemeProvider theme={lightThemeStyled}>
                <ModalOverlayGlobalStyles />
                <Theme
                    appearance="light"
                    accentColor="grass"
                    grayColor="olive"
                    radius="large"
                    panelBackground="solid"
                    hasBackground
                >
                    {routerContent}
                </Theme>
            </ThemeProvider>
        </I18nextProvider>
    );
};

export { PublicApp };
