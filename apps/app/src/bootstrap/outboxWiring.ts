// The wiring of the expense outbox (spec 03 §2.1, §2.3; 03-15b). Its code is loaded only with
// `VITE_FEATURE_OFFLINE_WRITES` on: off, nothing of the outbox is loaded, read or written, and the
// landing bundle does not grow. On: a user's new client registers the outbox defaults and restores
// the persisted ops; every new access token re-checks the outbox owner (the `auth` gate).
import * as Sentry from '@sentry/react';
import type { QueryClient } from '@tanstack/react-query';

import { getAccessTokenSubject } from 'helpers/authSession';
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';

/** `clientFor` → the user's outbox starts (defaults first, then the restore). */
export const startUserOutbox = (client: QueryClient, userId: string): void => {
    if (!isOfflineWritesFlagOn()) {
        return;
    }
    import('hooks/useLedgerMutations')
        .then(({ startUserLedgerOutbox }) => startUserLedgerOutbox(client, userId))
        .catch((error: unknown) => Sentry.captureException(error));
};

/** The interceptor's `onAccessTokenChanged`: the `auth` gate opens only for the owner's token. */
export const recheckOutboxOwnerOnToken = (token: string): void => {
    if (!isOfflineWritesFlagOn()) {
        return;
    }
    const subject = getAccessTokenSubject(token);

    import('shared/offline/outboxRun')
        .then(({ recheckOutboxOwner }) => recheckOutboxOwner(subject))
        .catch((error: unknown) => Sentry.captureException(error));
};
