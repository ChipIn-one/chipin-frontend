import { Suspense } from 'react';
import { Box, Spinner } from '@radix-ui/themes';
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

import { RestoreGate } from 'app/providers/RestoreGate';
import { ServiceWorkerSafePoints } from 'app/pwa/ServiceWorkerSafePoints';
import { UpdateRequiredScreen } from 'app/pwa/UpdateRequiredScreen';
import { AddExpenseModal } from 'features/add-expense';
import { isThemeDark } from 'helpers/theme';
import { useIsMobile } from 'hooks/common';
import GlobalHooks from 'pages/GlobalHooks';

import BackgroundBox from 'basics/BackgroundBox';
import PageLoader from 'basics/PageLoader';
import AddExpenseButton from 'components/AddExpenseButton';
import { BackendUnavailableGate } from 'components/backend-unavailable-page';
import { Header } from 'components/Header';
import { EarlySupporterPromoModal } from 'components/modals/early-supporter-promo-modal';

const ToastSuccessIcon = () => <CircleCheckIcon size={20} />;
const ToastInfoIcon = () => <InfoIcon size={20} />;
const ToastWarningIcon = () => <TriangleAlertIcon size={20} />;
const ToastErrorIcon = () => <CircleXIcon size={20} />;
const ToastLoadingIcon = () => <Spinner size="2" />;

/**
 * The root route element (spec 04 §2.3): the shell that was inside `<BrowserRouter>`, in the same
 * order, with the matched route in place of `<AppRouter/>`. The `Suspense` keeps the former
 * fallback for anything that suspends while a page renders.
 */
const RootLayout = () => {
    const { resolvedTheme } = useTheme();
    const isMobile = useIsMobile();

    return (
        <BackgroundBox>
            <BackendUnavailableGate>
                <Header />
                <RestoreGate>
                    <GlobalHooks />
                    <Box px="4">
                        <Suspense fallback={<PageLoader />}>
                            <Outlet />
                        </Suspense>
                    </Box>
                    <AddExpenseButton />
                    <AddExpenseModal />
                </RestoreGate>
                {/* The SW registration itself is in root.tsx: once per page, not per user. */}
                <ServiceWorkerSafePoints />

                <Toaster
                    theme={isThemeDark(resolvedTheme) ? 'dark' : 'light'}
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
            <UpdateRequiredScreen />
        </BackgroundBox>
    );
};

export { RootLayout };
