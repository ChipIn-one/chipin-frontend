import { Box } from '@radix-ui/themes';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import { OutboxControls } from 'features/offline-queue';
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';

import { InternalPageLayout } from 'components/internal-page-layout';

// The page paddings of the protected routes, formerly baked into `ProtectedRoute` (spec 04 §2.3).
const ProtectedPagePadding = ({ children }: { children: ReactNode }) => (
    <Box pt={{ initial: '4', sm: '6' }} pb={{ initial: '4', sm: '6' }}>
        {children}
    </Box>
);

// One layout route for the internal pages: React reuses it across their navigations, as it reused
// the same element tree of every `InternalRoute` before. The outbox badge, banner and sheet
// (03-16a part B) exist only with offline writes on. The session guard is `AuthLayout` above it.
const InternalLayout = () => (
    <ProtectedPagePadding>
        <InternalPageLayout outbox={isOfflineWritesFlagOn() ? <OutboxControls /> : undefined}>
            <Outlet />
        </InternalPageLayout>
    </ProtectedPagePadding>
);

/** The protected pages without navigation (the join pages): only the paddings. */
const BareLayout = () => (
    <ProtectedPagePadding>
        <Outlet />
    </ProtectedPagePadding>
);

export { BareLayout, InternalLayout };
