import { Theme } from '@radix-ui/themes';
import { useTheme } from 'next-themes';
import { ThemeProvider } from 'styled-components';

import { usePersistedUserId } from 'app/providers/persistedUserId';
import { UserQueryProvider } from 'app/providers/UserQueryProvider';
import { AppRouterProvider } from 'app/router/AppRouterProvider';
import { darkThemeStyled, lightThemeStyled } from 'constants/styled-themes';
import { isThemeDark } from 'helpers/theme';

import { ModalOverlayGlobalStyles } from 'components/modals/components';

const Main = () => {
    const { resolvedTheme } = useTheme();
    const isDarkTheme = isThemeDark(resolvedTheme);
    const themeName = isDarkTheme ? 'dark' : 'light';
    const styledThemeParams = isDarkTheme ? darkThemeStyled : lightThemeStyled;
    const userId = usePersistedUserId();

    return (
        <UserQueryProvider userId={userId}>
            <ThemeProvider theme={styledThemeParams}>
                <ModalOverlayGlobalStyles />
                <Theme
                    appearance={themeName}
                    accentColor="grass"
                    grayColor="olive"
                    radius="large"
                    panelBackground="solid"
                    hasBackground
                >
                    {/* The router: created once per user client, see AppRouterProvider (no StrictMode). */}
                    <AppRouterProvider />
                </Theme>
            </ThemeProvider>
        </UserQueryProvider>
    );
};

export default Main;
