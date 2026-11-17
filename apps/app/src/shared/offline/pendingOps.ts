// Whether a query cache entry has an unsent outbox operation (spec 03 §1.4, §2.2): such an
// optimistic entry is never persisted. Stub until the outbox exists: 03-15a replaces the
// implementation (`['ledger','entry',id]` with `id` in `outboxState.entryIds`), not this path.
import type { QueryKey } from '@tanstack/react-query';

export const isEntryWithPendingOp = (_queryKey: QueryKey): boolean => false;
