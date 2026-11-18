import { useOutboxOverlay } from 'entities/ledger';

/**
 * Why settle-up is refused now (03-16a part C, spec 03 §2.4 (11), §3), or null: the balance it reads
 * is the server's and excludes unsent expenses. `queued`: for a group, a pending or failed op of
 * that group; for `null` (friends: the balances span groups), any pending or failed op. Unreadable
 * records do not refuse it (M2; the caption still counts them). `checking` (L5): this tab has not
 * read the stored outbox yet. A failed read does not refuse (its banner and the caption stay).
 * Offline writes off: the overlay is empty (`off`), never refused.
 */
export const useSettleUpRefusal = (groupId: string | null): 'queued' | 'checking' | null => {
    const { restore, pending, failed, queuedGroupIds } = useOutboxOverlay();

    if (restore === 'pending') {
        return 'checking';
    }
    const isQueued =
        groupId === null ? pending.length + failed.length > 0 : queuedGroupIds.has(groupId);

    return isQueued ? 'queued' : null;
};
