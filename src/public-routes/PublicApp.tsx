import { I18nextProvider } from 'react-i18next';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import type { i18n as I18nInstance } from 'i18next';

import { Theme } from '@radix-ui/themes';

import { lightThemeStyled } from 'constants/styled-themes';
import type { PublicRoute } from 'types/publicRoutes';

import { ModalOverlayGlobalStyles } from 'components/modals/components';

import { PublicContent } from './PublicContent';

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
