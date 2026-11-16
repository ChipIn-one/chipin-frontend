// Whether a query cache entry has an unsent outbox operation (spec 03 §1.4, §2.2): such an
// optimistic entry is never persisted. `['ledger','entry',id]` with `id` among the entries of
// the pending and failed ops (C2-08: 03-15a replaced the stub, not this path).
import type { QueryKey } from '@tanstack/react-query';

import { outboxEntryIds } from './outboxStore';

export const isEntryWithPendingOp = (queryKey: QueryKey): boolean => {
    const [scope, kind, id] = queryKey;

    return (
        queryKey.length === 3 &&
        scope === 'ledger' &&
        kind === 'entry' &&
        typeof id === 'string' &&
        outboxEntryIds().has(id)
    );
};
