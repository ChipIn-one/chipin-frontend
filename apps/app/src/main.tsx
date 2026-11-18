import { useEffect, useState } from 'react';
import { Theme } from '@radix-ui/themes';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';

import { usePersistedUserId } from 'app/providers/persistedUserId';
import { UserQueryProvider } from 'app/providers/UserQueryProvider';
import { createAppRouter } from 'app/router/createAppRouter';
import { darkThemeStyled, lightThemeStyled } from 'constants/styled-themes';
import { isThemeDark } from 'helpers/theme';

import { ModalOverlayGlobalStyles } from 'components/modals/components';

// One router per query client: `UserQueryProvider` remounts this subtree for another user, and the
// new router starts from the current URL, as the remounted `BrowserRouter` did. The old router stops
// listening to the history (no `StrictMode` in this app, so the cleanup runs only on a real unmount).
const AppRouterProvider = () => {
    const queryClient = useQueryClient();
    const [router] = useState(() => createAppRouter(queryClient));

    useEffect(() => () => router.dispose(), [router]);

    return <RouterProvider router={router} />;
};

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
                    <AppRouterProvider />
                </Theme>
            </ThemeProvider>
        </UserQueryProvider>
    );
};

export default Main;
