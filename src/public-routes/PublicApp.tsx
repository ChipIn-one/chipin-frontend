import { useSyncExternalStore } from 'react';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import type { i18n as I18nInstance } from 'i18next';

import { Theme } from '@radix-ui/themes';

import { darkThemeStyled, lightThemeStyled } from 'constants/styled-themes';
import { isPreferredPublicThemeDark } from 'helpers/theme';
import type { PublicRoute } from 'types/publicRoutes';

import { ModalOverlayGlobalStyles } from 'components/modals/components';

import { PublicContent } from './PublicContent';

interface PublicAppProps {
    route: PublicRoute;
    i18nInstance: I18nInstance;
    server?: boolean;
}

const getSystemDark = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

const getPreferredDark = (): boolean => isPreferredPublicThemeDark(getSystemDark());

const subscribeToPreferredTheme = (onChange: () => void): (() => void) => {
    if (typeof window === 'undefined') {
        return () => undefined;
    }
    window.addEventListener('storage', onChange);
    if (typeof window.matchMedia !== 'function') {
        return () => window.removeEventListener('storage', onChange);
    }
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    preference.addEventListener('change', onChange);
    return () => {
        preference.removeEventListener('change', onChange);
        window.removeEventListener('storage', onChange);
    };
};

// The server snapshot matches the first hydration render. After hydration,
// cached last-account appearance wins over system preference when available.
const PublicApp = ({ route, i18nInstance, server = false }: PublicAppProps) => {
    const isDark = useSyncExternalStore(subscribeToPreferredTheme, getPreferredDark, () => false);
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
            <ThemeProvider theme={isDark ? darkThemeStyled : lightThemeStyled}>
                <ModalOverlayGlobalStyles />
                <Theme
                    appearance={isDark ? 'dark' : 'light'}
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
