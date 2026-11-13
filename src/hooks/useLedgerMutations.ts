// The ledger mutations for the UI (spec 03 §6 row 6): create and update an expense, delete a
// ledger entry. Like the group mutations, they run only while signed in on the user's persisted
// client, and offline they are refused before `mutate` (online only until the outbox, spec 03
// §2.1), so nothing waits paused for a reconnect. A write of a kind that is already running is
// refused as well (a double submit sends one request). A refusal or a failure rejects: the
// caller shows `ledgerWriteErrorMessage`. `isPending` is true while a write of that kind runs on
// the user's client, until what shows the entry has reloaded.
import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';

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
import { getAuthSessionVersion } from 'helpers/authSession';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { isNetworkUsable } from 'shared/offline/network';
import { useActivityStore } from 'store/activity-store';
import { invalidateGroup } from 'store/groupsList';
import { invalidateDashboard } from 'store/internal/dashboardQueryBridge';
import { invalidateKnownUsers } from 'store/sessionUser';

import { useIsUserWriteEnabled } from './useUserMutations';

/**
 * Why a ledger write was not sent: `session` — signed out or on the anonymous client; `offline` —
 * no network; `busy` — a write of the same kind is still running (a repeated submit).
 */
export type LedgerWriteRefusal = 'session' | 'offline' | 'busy';

/** A ledger write refused before it was sent. */
export class LedgerWriteRefusedError extends Error {
    readonly reason: LedgerWriteRefusal;

    constructor(reason: LedgerWriteRefusal) {
        super(`Ledger write refused: ${reason}`);
        this.reason = reason;
    }
}

/** A repeated submit of a running write: the caller shows nothing, the first one answers. */
export const isRepeatedLedgerWrite = (error: unknown): boolean =>
    error instanceof LedgerWriteRefusedError && error.reason === 'busy';

/** The toast text of a refused or failed ledger write; `fallback` when the error names no cause. */
export const ledgerWriteErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof LedgerWriteRefusedError && error.reason === 'offline'
        ? i18n.t('errors:network.offline')
        : resolveApiErrorMessageFromError(error, fallback);

// What reads the written entry again, until those views are queries of their own entities: the
// same refresh functions the activity store calls after its ledger writes. One place, so the
// activity-feed migration (03-12) replaces them here.
const storeEffects: LedgerWriteEffects = {
    onEntryWritten: ({ groupId, parentActivityId }) => {
        const activity = useActivityStore.getState();
        const refreshes: Promise<void>[] = [
            invalidateDashboard(),
            activity.fetchSetActivity(true),
            groupId ? invalidateGroup(groupId) : invalidateKnownUsers(),
        ];

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

const useIsWriting = (mutationKey: LedgerMutationKey): boolean =>
    useIsMutating({ mutationKey }) > 0;

/** Settles once the dashboard, the feeds and the group or friends of the new expense reloaded. */
export const useCreateExpense = () => {
    const client = useQueryClient();
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(createExpenseMutationOptions(storeEffects));
    const createExpense = useCallback(
        (params: CreateExpenseParams): Promise<void> =>
            refusalBeforeMutate(client, isEnabled, ledgerOnlineMutationKeys.createEntry) ??
            mutateAsync({ ...params, sessionVersion: getAuthSessionVersion() }),
        [client, isEnabled, mutateAsync],
    );

    return { createExpense, isPending: useIsWriting(ledgerOnlineMutationKeys.createEntry) };
};

/** Settles once what shows the updated expense has reloaded. */
export const useUpdateExpense = () => {
    const client = useQueryClient();
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(updateExpenseMutationOptions(storeEffects));
    const updateExpense = useCallback(
        (params: UpdateExpenseParams): Promise<void> =>
            refusalBeforeMutate(client, isEnabled, ledgerOnlineMutationKeys.updateEntry) ??
            mutateAsync({ ...params, sessionVersion: getAuthSessionVersion() }),
        [client, isEnabled, mutateAsync],
    );

    return { updateExpense, isPending: useIsWriting(ledgerOnlineMutationKeys.updateEntry) };
};

/** Deletes an expense or a settlement; settles once what showed it has reloaded. */
export const useDeleteLedgerEntry = () => {
    const client = useQueryClient();
    const isEnabled = useIsUserWriteEnabled();
    const { mutateAsync } = useMutation(deleteLedgerEntryMutationOptions(storeEffects));
    const deleteLedgerEntry = useCallback(
        (params: DeleteLedgerEntryParams): Promise<void> =>
            refusalBeforeMutate(client, isEnabled, ledgerOnlineMutationKeys.deleteEntry) ??
            mutateAsync({ ...params, sessionVersion: getAuthSessionVersion() }),
        [client, isEnabled, mutateAsync],
    );

    return { deleteLedgerEntry, isPending: useIsWriting(ledgerOnlineMutationKeys.deleteEntry) };
};
