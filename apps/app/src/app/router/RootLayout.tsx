import { Suspense } from 'react';
import { Box } from '@radix-ui/themes';
import { Outlet, ScrollRestoration } from 'react-router-dom';

import { RestoreGate } from 'app/providers/RestoreGate';
import { ServiceWorkerSafePoints } from 'app/pwa/ServiceWorkerSafePoints';
import { AddExpenseModal } from 'features/add-expense';
import { GlobalHooks } from 'pages/GlobalHooks';

import BackgroundBox from 'basics/BackgroundBox';
import { PageLoader } from 'basics/PageLoader';
import { AddExpenseButton } from 'components/AddExpenseButton';
import { BackendUnavailableGate } from 'components/backend-unavailable-page';
import { Header } from 'components/Header';
import { EarlySupporterPromoModal } from 'components/modals/early-supporter-promo-modal';

import { TopLayer } from './TopLayer';
import { useDocumentTitle } from './useDocumentTitle';

// Inside `RestoreGate`, so the group query of the title waits for the restored cache (spec 03 §1.6),
// and in its own component so a title update does not re-render the whole shell.
const DocumentTitle = () => {
    useDocumentTitle();

    return null;
};

/**
 * The root route element (spec 04 §2.3): the shell that was inside `<BrowserRouter>`, in the same
 * order, with the matched route in place of `<AppRouter/>`. The `Suspense` keeps the former
 * fallback for anything that suspends while a page renders.
 */
const RootLayout = () => {
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
                    <DocumentTitle />
                    <AddExpenseButton />
                    <AddExpenseModal />
                </RestoreGate>
                {/* The SW registration itself is in root.tsx: once per page, not per user. */}
                <ServiceWorkerSafePoints />
                <ScrollRestoration />
            </BackendUnavailableGate>
            <TopLayer />
            <EarlySupporterPromoModal />
        </BackgroundBox>
    );
};

export { RootLayout };
