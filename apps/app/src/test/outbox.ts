// Test support: the expense outbox (spec 03 §2.3) for tests of the layers that may not import
// `shared/offline`: the queued ops, a reset of this tab's outbox memory, and a stored conflict
// draft (§2.6, 03-16b).
import { set } from 'idb-keyval';

import { outboxStateKey } from 'shared/offline/constants';
import { persistCodec } from 'shared/offline/persistCodec';

export { outboxConflictDraft, pendingOutboxOps, resetOutbox } from 'shared/offline/outboxStore';

/** Writes `userId`'s outbox key with no op and these conflict drafts (call before the restore). */
export const storeConflictDrafts = (
    userId: string,
    drafts: Record<string, Record<string, unknown>>,
): Promise<void> =>
    set(
        outboxStateKey(userId),
        persistCodec.stringify({
            nextSeq: 1,
            ops: [],
            versions: {},
            cancelled: [],
            retryRequested: [],
            sending: null,
            conflictDrafts: drafts,
        }),
    );
