import { useOutboxOverlay } from 'entities/ledger';

/**
 * 03-16a part C (spec 03 §2.4 (11), §3): settle-up is refused while expenses it would settle are
 * unsent, since the balance it reads is the server's and excludes them. A group: an op of that
 * group is pending, failed or unreadable. `null` (friends: the balances span groups): any op at
 * all. Offline writes off: the overlay is empty, never refused.
 */
export const useIsSettleUpRefused = (groupId: string | null): boolean => {
    const { count, queuedGroupIds } = useOutboxOverlay();

    return groupId === null ? count > 0 : queuedGroupIds.has(groupId);
};
