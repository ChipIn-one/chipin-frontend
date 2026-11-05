import { Box, Spinner, Theme } from '@radix-ui/themes';
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'styled-components';

import { usePersistedUserId } from 'app/providers/persistedUserId';
import { RestoreGate } from 'app/providers/RestoreGate';
import { UserQueryProvider } from 'app/providers/UserQueryProvider';
import { darkThemeStyled, lightThemeStyled } from 'constants/styled-themes';
import AppRouter from 'features/routing';
import { isThemeDark } from 'helpers/theme';
import { useIsMobile } from 'hooks/common';
import GlobalHooks from 'pages/GlobalHooks';

import BackgroundBox from 'basics/BackgroundBox';
import PWABadge from 'basics/PWABadge';
import AddExpenseButton from 'components/AddExpenseButton';
import { BackendUnavailableGate } from 'components/backend-unavailable-page';
import Header from 'components/Header';
import { AddExpenseModal } from 'components/modals/add-expense-modal';
import { ModalOverlayGlobalStyles } from 'components/modals/components';
import { EarlySupporterPromoModal } from 'components/modals/early-supporter-promo-modal';

const ToastSuccessIcon = () => <CircleCheckIcon size={20} />;
const ToastInfoIcon = () => <InfoIcon size={20} />;
const ToastWarningIcon = () => <TriangleAlertIcon size={20} />;
const ToastErrorIcon = () => <CircleXIcon size={20} />;
const ToastLoadingIcon = () => <Spinner size="2" />;

const Main = () => {
    const { resolvedTheme } = useTheme();
    const isDarkTheme = isThemeDark(resolvedTheme);
    const themeName = isDarkTheme ? 'dark' : 'light';
    const styledThemeParams = isDarkTheme ? darkThemeStyled : lightThemeStyled;
    const isMobile = useIsMobile();
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
                    <BrowserRouter>
                        <BackgroundBox>
                            <BackendUnavailableGate>
                                <Header />
                                <RestoreGate>
                                    <GlobalHooks />
                                    <Box px="4">
                                        <AppRouter />
                                    </Box>
                                    <AddExpenseButton />
                                    <AddExpenseModal />
                                </RestoreGate>
                                <PWABadge />

                                <Toaster
                                    theme={themeName}
                                    richColors
                                    closeButton
                                    position={isMobile ? 'top-center' : 'bottom-left'}
                                    offset={isMobile ? 12 : 16}
                                    mobileOffset={isMobile ? 12 : 16}
                                    icons={{
                                        success: <ToastSuccessIcon />,
                                        info: <ToastInfoIcon />,
                                        warning: <ToastWarningIcon />,
                                        error: <ToastErrorIcon />,
                                        loading: <ToastLoadingIcon />,
                                    }}
                                />
                            </BackendUnavailableGate>
                            <EarlySupporterPromoModal />
                        </BackgroundBox>
                    </BrowserRouter>
                </Theme>
            </ThemeProvider>
        </UserQueryProvider>
    );
};

export default Main;
