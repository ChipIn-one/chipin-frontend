import { ThemeProvider } from 'styled-components';

import { usePersistedUserId } from 'app/providers/persistedUserId';
import { UserQueryProvider } from 'app/providers/UserQueryProvider';
import { AppRouterProvider } from 'app/router/AppRouterProvider';
import { darkThemeStyled, lightThemeStyled } from 'constants/styled-themes';
import { AppTheme } from 'design-system/AppTheme';
import { initAppearance, selectResolvedAppearance, useAppearanceStore } from 'store/ui-prefs';

import { ModalOverlayGlobalStyles } from 'components/modals/components';

// Spec 05 §2: `main` is imported only by the SPA branch of root.tsx, before its first render; the
// public pages keep their own theme control.
initAppearance();

const Main = () => {
    const appearance = useAppearanceStore(selectResolvedAppearance);
    const styledThemeParams = appearance === 'dark' ? darkThemeStyled : lightThemeStyled;
    const userId = usePersistedUserId();

    return (
        <UserQueryProvider userId={userId}>
            <ThemeProvider theme={styledThemeParams}>
                <ModalOverlayGlobalStyles />
                <AppTheme appearance={appearance}>
                    {/* The router: created once per user client, see AppRouterProvider (no StrictMode). */}
                    <AppRouterProvider />
                </AppTheme>
            </ThemeProvider>
        </UserQueryProvider>
    );
};

export { Main };
