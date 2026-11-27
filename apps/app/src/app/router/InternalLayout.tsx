import { Box, Flex } from '@radix-ui/themes';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import { OutboxControls } from 'features/offline-queue';
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';

import { InternalPageLayout } from 'components/internal-page-layout';
import { OfflineBanner } from 'components/offline-banner';

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

/**
 * The protected pages without navigation (the join pages): the paddings and the inline offline
 * banner (NET-001), as `InternalPageLayout` mounts it for the internal pages. The banner takes the
 * width of the centred join card.
 */
const BareLayout = () => (
    <ProtectedPagePadding>
        <Flex justify="center" px="4">
            <Box width="100%" maxWidth="480px">
                <OfflineBanner />
            </Box>
        </Flex>
        <Outlet />
    </ProtectedPagePadding>
);

export { BareLayout, InternalLayout };
