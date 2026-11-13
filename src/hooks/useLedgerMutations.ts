// The ledger mutations for the UI (spec 03 §6 row 6): create and update an expense, delete a
// ledger entry. Like the group mutations, they run only while signed in on the user's persisted
// client, and offline they are refused before `mutate` (online only until the outbox, spec 03
// §2.1), so nothing waits paused for a reconnect. A write of a kind that is already running is
// refused as well (a double submit sends one request), and so is the answer of a write whose
// session ended meanwhile. A refusal or a failure rejects: the caller shows it with
// `toastLedgerWriteError`. `isPending` is true while a write of that kind runs on
// the user's client: until what shows the entry has reloaded, or until the write failed.
import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
    createExpenseMutationOptions,
    type CreateExpenseParams,
    deleteLedgerEntryMutationOptions,
    type DeleteLedgerEntryParams,
    ledgerOnlineMutationKeys,
    type LedgerWriteEffects,
    updateExpenseMutationOptions,
    type UpdateExpenseParams,
} from 'entities/ledger';
import { getAuthSessionVersion, isAuthSessionCurrent } from 'helpers/authSession';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { isNetworkUsable } from 'shared/offline/network';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { useActivityStore } from 'store/activity-store';
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

// What reads the written entry again once a sent write settles, until those views are queries of
// their own entities: the same refresh functions the activity store calls after its ledger writes. One place, so the
// activity-feed migration (03-12) replaces them here.
const invalidateBalances = (groupId: string | undefined): Promise<void>[] => [
    invalidateDashboard(),
    groupId ? invalidateGroup(groupId) : invalidateKnownUsers(),
];

const storeEffects: LedgerWriteEffects = {
    onEntryWritten: ({ groupId, parentActivityId }) => {
        const activity = useActivityStore.getState();
        const refreshes = [...invalidateBalances(groupId), activity.fetchSetActivity(true)];

        if (parentActivityId) {
            refreshes.push(
                activity.fetchSetActivitySubevents({
                    parentActivityId,
                    category:
                        activity.subeventsParent?.id === parentActivityId
                            ? (activity.subeventsCategory ?? undefined)
                            : undefined,
                    force: true,
                }),
            );
        }
        return Promise.all(refreshes).then(() => undefined);
    },
    // The queries pause offline and refetch on the reconnect. The forced reload of the legacy feed
    // is skipped offline because it would only fail. The expense history is not reloaded at all:
    // its forced reload blanks the page (skeletons) and closes the open delete dialog.
    // TODO(03-12): the expense history becomes a query there and is invalidated on a failure too.
    // The `isNetworkUsable()` skip goes away when `fetchSetActivity` becomes the bridge to the
    // `activity.self` query: an invalidation pauses offline and resumes on the reconnect, so a
    // timed-out but committed write still shows after the reconnect.
    onWriteFailed: ({ groupId }) => {
        const refreshes = invalidateBalances(groupId);

        if (isNetworkUsable()) {
            refreshes.push(useActivityStore.getState().fetchSetActivity(true));
        }
        return Promise.all(refreshes).then(() => undefined);
    },
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

// One write of a kind at a time on the user's client, bound to the session it was made in.
const useLedgerWrite = <Params>(
    mutationKey: LedgerMutationKey,
    mutateAsync: (variables: Params & { sessionVersion: number }) => Promise<void>,
) => {
    const client = useQueryClient();
    const isEnabled = useIsUserWriteEnabled();
    const write = useCallback(
        (params: Params): Promise<void> => {
            const refusal = refusalBeforeMutate(client, isEnabled, mutationKey);

            if (refusal) {
                return refusal;
            }
            const sessionVersion = getAuthSessionVersion();

            return inItsSession(client, sessionVersion, mutateAsync({ ...params, sessionVersion }));
        },
        [client, isEnabled, mutateAsync, mutationKey],
    );

    return { write, isPending: useIsWriting(mutationKey) };
};

/** Resolves once the dashboard, the feeds and the group or friends of the new expense reloaded. */
export const useCreateExpense = () => {
    const { mutateAsync } = useMutation(createExpenseMutationOptions(storeEffects));
    const { write, isPending } = useLedgerWrite<CreateExpenseParams>(
        ledgerOnlineMutationKeys.createEntry,
        mutateAsync,
    );

    return { createExpense: write, isPending };
};

/** Resolves once what shows the updated expense has reloaded. */
export const useUpdateExpense = () => {
    const { mutateAsync } = useMutation(updateExpenseMutationOptions(storeEffects));
    const { write, isPending } = useLedgerWrite<UpdateExpenseParams>(
        ledgerOnlineMutationKeys.updateEntry,
        mutateAsync,
    );

    return { updateExpense: write, isPending };
};

/** Deletes an expense or a settlement; resolves once what showed it has reloaded. */
export const useDeleteLedgerEntry = () => {
    const { mutateAsync } = useMutation(deleteLedgerEntryMutationOptions(storeEffects));
    const { write, isPending } = useLedgerWrite<DeleteLedgerEntryParams>(
        ledgerOnlineMutationKeys.deleteEntry,
        mutateAsync,
    );

    return { deleteLedgerEntry: write, isPending };
};
