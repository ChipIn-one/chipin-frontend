import { Outlet } from 'react-router-dom';

import { OutboxControls } from 'features/offline-queue';
import { ProtectedRoute } from 'features/routing';
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';

import { InternalPageLayout } from 'components/internal-page-layout';

// One layout route for the internal pages: React reuses it across their navigations, as it reused
// the same element tree of every `InternalRoute` before. The outbox badge, banner and sheet
// (03-16a part B) exist only with offline writes on.
const InternalLayout = () => (
    <ProtectedRoute>
        <InternalPageLayout outbox={isOfflineWritesFlagOn() ? <OutboxControls /> : undefined}>
            <Outlet />
        </InternalPageLayout>
    </ProtectedRoute>
);

export { InternalLayout };
