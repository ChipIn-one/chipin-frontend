// The ledger mutations for the UI (spec 03 §6 row 6): create and update an expense, record a
// settlement (settle-up), delete a ledger entry. Like the group mutations, they run only while
// signed in on the user's persisted client, and offline they are refused before `mutate` (online
// only while offline writes are off, spec 03 §2.1), so nothing waits paused for a reconnect. With
// `VITE_FEATURE_OFFLINE_WRITES` on, an expense is queued in the outbox instead (03-15a). A write of
// a kind that is already running is refused as well (a double submit sends one request), and so
// is the answer of a write whose session ended meanwhile. A refusal or a failure rejects: the
// caller shows it with `toastLedgerWriteError`. `isPending` is true while a write of that kind
// runs on the user's client: until what shows the entry has reloaded, or until the write failed.
import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { invalidateActivityChildren, invalidateSelfActivity } from 'entities/activity';
import {
    createExpenseMutationOptions,
    type CreateExpenseParams,
    createExpenseViaOutbox,
    createSettlementMutationOptions,
    type CreateSettlementParams,
    deleteExpenseViaOutbox,
    deleteLedgerEntryMutationOptions,
    type DeleteLedgerEntryParams,
    ledgerOnlineMutationKeys,
    type LedgerWriteContext,
    type LedgerWriteEffects,
    updateExpenseMutationOptions,
    type UpdateExpenseParams,
    updateExpenseViaOutbox,
} from 'entities/ledger';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { isNetworkUsable } from 'shared/offline/network';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { invalidateGroup } from 'store/groupsList';
import { invalidateDashboard } from 'store/internal/dashboardQueryBridge';
import { invalidateKnownUsers } from 'store/sessionUser';

import { toastWriteRefusal, useIsUserWriteEnabled } from './useUserMutations';

/**
 * Why a ledger write was refused. `session` — signed out or on the anonymous client (not sent),
 * or the session ended while the write ran: that write was sent and may have been applied, its
 * answer is dropped. `offline` — no network, not sent. `busy` — a write of the same kind is still
 * running (a repeated submit), not sent.
 */
export type LedgerWriteRefusal = 'session' | 'offline' | 'busy';

/** A ledger write refused before it was sent, or whose answer came after its session ended. */
export class LedgerWriteRefusedError extends Error {
    readonly reason: LedgerWriteRefusal;

    constructor(reason: LedgerWriteRefusal) {
        super(`Ledger write refused: ${reason}`);
        this.reason = reason;
    }
}

/**
 * The toast of a ledger write that rejected. A refusal shows what a refused user write shows
 * (`toastWriteRefusal`: offline says so, an ended session nothing), and a repeated submit of a
 * running write nothing (the first one answers); any other failure its backend message, or
 * `fallbackMessage`.
 */
export const toastLedgerWriteError = (error: unknown, fallbackMessage: string): void => {
    if (error instanceof LedgerWriteRefusedError) {
        if (error.reason !== 'busy') {
            toastWriteRefusal(error.reason);
        }
        return;
    }
    toast.error(resolveApiErrorMessageFromError(error, fallbackMessage));
};

// What reads the written entry again once a sent write settles, on the write's own client. The
// user's own activity feeds and the open expense history are queries of `entities/activity`; the
// dashboard, the group and the friends are refreshed by the functions the legacy stores use, until
// they are queries of their own entities.
const invalidateViews = (
    { groupId, parentActivityId }: LedgerWriteContext,
    client: QueryClient,
): Promise<void>[] => [
    invalidateDashboard(),
    groupId ? invalidateGroup(groupId) : invalidateKnownUsers(),
    invalidateSelfActivity(client),
    ...(parentActivityId ? [invalidateActivityChildren(client, parentActivityId)] : []),
];

const storeEffects: LedgerWriteEffects = {
    onEntryWritten: (context, client) =>
        Promise.all(invalidateViews(context, client)).then(() => undefined),
    // The queries pause offline and refetch on the reconnect, so a timed-out but committed write
    // still shows after it (the caller does not wait for this refresh). After a network drop the
    // self feeds are cut to their first page at once; after the reconnect the first page reloads
    // and further pages load again on demand (the group feed already behaves this way). The
    // expense history refetches in the background: it keeps showing its events (and an open
    // delete dialog) meanwhile.
    onWriteFailed: (context, client) =>
        Promise.all(invalidateViews(context, client)).then(() => undefined),
};

type LedgerMutationKey = (typeof ledgerOnlineMutationKeys)[keyof typeof ledgerOnlineMutationKeys];

// TODO(spec 03 §2.9): disable the controls offline with `useRequiresOnline()` / `<OnlineOnly>`
// once they exist; until then an offline write is refused here and the caller's toast shows it.
const refusalBeforeMutate = (
    client: QueryClient,
    isEnabled: boolean,
    mutationKey: LedgerMutationKey,
): Promise<never> | null => {
    if (!isEnabled) {
        return Promise.reject(new LedgerWriteRefusedError('session'));
    }
    if (client.isMutating({ mutationKey }) > 0) {
        return Promise.reject(new LedgerWriteRefusedError('busy'));
    }
    return isNetworkUsable() ? null : Promise.reject(new LedgerWriteRefusedError('offline'));
};

// The answer of a write whose session ended meanwhile (a sign-out, an account switch here or in
// another tab) belongs to nobody on screen: neither its success nor its failure is shown, the
// caller gets a `session` refusal.
const inItsSession = (
    client: QueryClient,
    sessionVersion: number,
    write: Promise<void>,
): Promise<void> => {
    const refuseIfEnded = (): void => {
        if (!isAuthSessionCurrent(sessionVersion) || !isUserCacheClient(client)) {
            throw new LedgerWriteRefusedError('session');
        }
    };

    return write.then(refuseIfEnded, (error: unknown) => {
        refuseIfEnded();
        throw error;
    });
};

const useIsWriting = (mutationKey: LedgerMutationKey): boolean =>
    useIsMutating({ mutationKey }) > 0;

/** The outbox path of a write (spec 03 §2.1), or null for the online path (always, flag off). */
type ViaOutbox<Params> = (
    client: QueryClient,
    effects: LedgerWriteEffects,
    params: Params,
) => Promise<void> | null;

// One write of a kind at a time on the user's client, bound to the session it was made in. An
// expense may instead be queued in the outbox (it resolves once queued, and is sent later).
const useLedgerWrite = <Params>(
    mutationKey: LedgerMutationKey,
    mutateAsync: (variables: Params & { sessionVersion: number }) => Promise<void>,
    viaOutbox?: ViaOutbox<Params>,
) => {
    const client = useQueryClient();
    const isEnabled = useIsUserWriteEnabled();
    const write = useCallback(
        (params: Params): Promise<void> => {
            const queued = isEnabled ? viaOutbox?.(client, storeEffects, params) : null;

            if (queued) {
                return queued;
            }
            const refusal = refusalBeforeMutate(client, isEnabled, mutationKey);

            if (refusal) {
                return refusal;
            }
            const sessionVersion = getAuthSessionVersion();

            return inItsSession(client, sessionVersion, mutateAsync({ ...params, sessionVersion }));
        },
        [client, isEnabled, mutateAsync, mutationKey, viaOutbox],
    );

    return { write, isPending: useIsWriting(mutationKey) };
};

/** Resolves once the dashboard, the feeds and the group or friends of the new expense reloaded. */
export const useCreateExpense = () => {
    const { mutateAsync } = useMutation(createExpenseMutationOptions(storeEffects));
    const { write, isPending } = useLedgerWrite<CreateExpenseParams>(
        ledgerOnlineMutationKeys.createEntry,
        mutateAsync,
        createExpenseViaOutbox,
    );

    return { createExpense: write, isPending };
};

/** Resolves once what shows the updated expense has reloaded. */
export const useUpdateExpense = () => {
    const { mutateAsync } = useMutation(updateExpenseMutationOptions(storeEffects));
    const { write, isPending } = useLedgerWrite<UpdateExpenseParams>(
        ledgerOnlineMutationKeys.updateEntry,
        mutateAsync,
        updateExpenseViaOutbox,
    );

    return { updateExpense: write, isPending };
};

/** Whether an expense or a settlement is being created (one write of that kind at a time). */
export const useIsLedgerEntryCreating = (): boolean =>
    useIsWriting(ledgerOnlineMutationKeys.createEntry);

/** Records a settlement (settle-up); resolves once what shows it has reloaded. */
export const useCreateSettlement = () => {
    const { mutateAsync } = useMutation(createSettlementMutationOptions(storeEffects));
    const { write, isPending } = useLedgerWrite<CreateSettlementParams>(
        ledgerOnlineMutationKeys.createEntry,
        mutateAsync,
    );

    return { createSettlement: write, isPending };
};

/** Deletes an expense or a settlement; resolves once what showed it has reloaded. */
export const useDeleteLedgerEntry = () => {
    const { mutateAsync } = useMutation(deleteLedgerEntryMutationOptions(storeEffects));
    const { write, isPending } = useLedgerWrite<DeleteLedgerEntryParams>(
        ledgerOnlineMutationKeys.deleteEntry,
        mutateAsync,
        deleteExpenseViaOutbox,
    );

    return { deleteLedgerEntry: write, isPending };
};
