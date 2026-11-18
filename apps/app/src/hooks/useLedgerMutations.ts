// The ledger mutations for the UI (spec 03 §6 row 6): create and update an expense, record a
// settlement (settle-up), delete a ledger entry. Like the group mutations, they run only while
// signed in on the user's persisted client, and offline they are refused before `mutate` (online
// only while offline writes are off, spec 03 §2.1), so nothing waits paused for a reconnect. With
// `VITE_FEATURE_OFFLINE_WRITES` on, an expense is queued in the outbox instead (03-15a). A write of
// a kind that is already running is refused as well (a double submit sends one request), and so
// is the answer of a write whose session ended meanwhile. A queued expense resolves
// `{ queued: true }` once its op is saved on the device (03-15b; offline it says so, and the caller
// shows no success toast of its own: the server has not answered, 03-16a L5). A refusal or a
// failure rejects: the caller shows it with `toastLedgerWriteError`. `isPending` is true while a
// write of that kind runs on the user's client: until what shows the entry has reloaded, or until
// the write failed.
import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
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
    ledgerKeys,
    ledgerOnlineMutationKeys,
    type LedgerWriteContext,
    type LedgerWriteEffects,
    type QueueLedgerWrite,
    startLedgerOutbox,
    updateExpenseMutationOptions,
    type UpdateExpenseParams,
    updateExpenseViaOutbox,
} from 'entities/ledger';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { isNetworkUsable } from 'shared/offline/network';
import { OutboxLimitError, OutboxPersistError } from 'shared/offline/outboxStore';
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
    // §2.8: the expense was not saved on the device (it does not exist). A write-lock timeout is
    // transient (try again, offline saving stays on); any other failure turns offline saving off.
    if (error instanceof OutboxPersistError) {
        toast.error(
            i18n.t(error.isTransient ? 'toasts:offline.saveRetry' : 'toasts:offline.saveFailed'),
        );
        return;
    }
    if (error instanceof OutboxLimitError) {
        toast.error(i18n.t('toasts:offline.limitReached'));
        return;
    }
    toast.error(resolveApiErrorMessageFromError(error, fallbackMessage));
};

// What reads the written entry again once a sent write settles, on the write's own client
// (`invalidateAfterLedgerOp`, §2.2). The user's own activity feeds and the open expense history
// are queries of `entities/activity`; the dashboard, the group and the friends are refreshed by the
// functions the legacy stores use, until they are queries of their own entities. `ledger.entry(id)`
// is cached only with offline writes on: otherwise its invalidation matches nothing.
const invalidateViews = (
    { groupId, parentActivityId, entryId }: LedgerWriteContext,
    client: QueryClient,
): Promise<void>[] => [
    invalidateDashboard(),
    groupId ? invalidateGroup(groupId) : invalidateKnownUsers(),
    invalidateSelfActivity(client),
    ...(parentActivityId ? [invalidateActivityChildren(client, parentActivityId)] : []),
    ...(entryId ? [client.invalidateQueries({ queryKey: ledgerKeys.entry(entryId) })] : []),
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

/**
 * Starts the expense outbox of a user's new client with these effects (spec 03 §2.1: defaults
 * before the restore); `bootstrap` wires it to `clientFor`. Flag off: nothing happens.
 */
export const startUserLedgerOutbox = (client: QueryClient, userId: string): Promise<void> =>
    startLedgerOutbox(client, userId, storeEffects).then(() => undefined);

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
type ViaOutbox<Params> = (client: QueryClient, params: Params) => QueueLedgerWrite | null;

/**
 * How a write resolved: `queued` — saved in the outbox, not answered by the server yet (its
 * toast, if any, is the hook's); otherwise the server answered and the views reloaded.
 */
export interface LedgerWriteResult {
    queued: boolean;
}

const QUEUED: LedgerWriteResult = { queued: true };
const ANSWERED: LedgerWriteResult = { queued: false };

// The writes of a kind being queued on a client: a repeated submit while one is queued is refused
// as busy, as on the online path, so one submit queues one op (one client entry id).
const queuing = new WeakMap<QueryClient, Set<LedgerMutationKey>>();

const queueOnce = (
    client: QueryClient,
    mutationKey: LedgerMutationKey,
    queue: QueueLedgerWrite,
): Promise<LedgerWriteResult> => {
    const kinds = queuing.get(client) ?? new Set<LedgerMutationKey>();

    if (kinds.has(mutationKey) || client.isMutating({ mutationKey }) > 0) {
        return Promise.reject(new LedgerWriteRefusedError('busy'));
    }
    kinds.add(mutationKey);
    queuing.set(client, kinds);
    return queue()
        .then(() => {
            // §2.8: only after the append write has landed; online the caller's own toast says it.
            if (!isNetworkUsable()) {
                toast.success(i18n.t('toasts:offline.saved'));
            }
            return QUEUED;
        })
        .finally(() => {
            kinds.delete(mutationKey);
        });
};

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
        (params: Params): Promise<LedgerWriteResult> => {
            const queue = isEnabled ? viaOutbox?.(client, params) : null;

            if (queue) {
                return queueOnce(client, mutationKey, queue);
            }
            const refusal = refusalBeforeMutate(client, isEnabled, mutationKey);

            if (refusal) {
                return refusal;
            }
            const sessionVersion = getAuthSessionVersion();

            return inItsSession(
                client,
                sessionVersion,
                mutateAsync({ ...params, sessionVersion }),
            ).then(() => ANSWERED);
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
    // Online only (§2.9): never queued, so the caller needs no result.
    const createSettlement = useCallback(
        (params: CreateSettlementParams): Promise<void> => write(params).then(() => undefined),
        [write],
    );

    return { createSettlement, isPending };
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
