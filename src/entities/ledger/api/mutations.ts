// The ledger entity mutations (spec 03 §2.1, §6 row 6): create and update an expense, delete a
// ledger entry (an expense or a settlement: one endpoint, spec 03 §2.9). Online only: no outbox,
// no retry, and the hooks refuse them offline before `mutate`. The keys are the online set of
// spec 03 §2.1; the outbox set and `registerLedgerMutationDefaults` arrive with 03-15a.
//
// Nothing is written into a cache here (the server is the source of truth for finances): once a
// sent write settles, what shows the entry is read again. Until the activity feed and the ledger
// entry are queries, that refresh is passed in (`LedgerWriteEffects`): entities never import
// `store`. A successful write settles when the refresh has; a failed one rejects at once and its
// refresh runs on its own. A write whose auth session has ended (a sign-out, an account switch,
// an expired session) refreshes nothing.
import type { QueryClient } from '@tanstack/react-query';
import { mutationOptions } from '@tanstack/react-query';

import type { CreateLedgerEntryParams, UpdateLedgerExpenseParams } from 'api/chipin.types';
import { isAuthSessionCurrent } from 'helpers/authSession';
import { api, InvalidPathSegmentError } from 'shared/api/client';
import { MoneyWireError } from 'shared/money';
import { isUserCacheClient } from 'shared/offline/userCaches';

import { legacyCreateExpenseBody, legacyUpdateExpenseBody } from './legacyExpenseWire';

export const ledgerOnlineMutationKeys = {
    createEntry: ['ledger', 'online', 'createEntry'],
    updateEntry: ['ledger', 'online', 'updateEntry'],
    deleteEntry: ['ledger', 'online', 'deleteEntry'],
} as const;

/** The variables of a ledger write: the auth session it was made in, checked before a refresh. */
interface SessionBound {
    /** `getAuthSessionVersion()` when the write was made. */
    sessionVersion: number;
}

/** Where the written entry shows: what is read again after the write. */
export interface LedgerWriteContext {
    /** The entry's group; without it the entry is between two friends. */
    groupId?: string;
    /** The root activity of the open activity history, if the write was made from it. */
    parentActivityId?: string;
}

export interface CreateExpenseParams {
    // TODO(03-14b): the draft on `Money` instead of the legacy number payload.
    expense: CreateLedgerEntryParams;
    parentActivityId?: string;
}

export interface UpdateExpenseParams extends LedgerWriteContext {
    entryId: string;
    // TODO(03-14b): the patch on `Money` instead of the legacy number payload.
    entry: UpdateLedgerExpenseParams;
}

export interface DeleteLedgerEntryParams extends LedgerWriteContext {
    entryId: string;
}

export type CreateExpenseVariables = CreateExpenseParams & SessionBound;
export type UpdateExpenseVariables = UpdateExpenseParams & SessionBound;
export type DeleteLedgerEntryVariables = DeleteLedgerEntryParams & SessionBound;

/** What the caller's stores and caches do after a ledger write, only while its session is current. */
export interface LedgerWriteEffects {
    /** Reads again what shows the entry, after a successful write; the write settles when it has. */
    onEntryWritten: (context: LedgerWriteContext) => Promise<void>;
    /**
     * Reads again what may be stale after a sent write failed. Not awaited: the failure reaches
     * the caller at once (offline this refresh waits for the reconnect).
     */
    onWriteFailed: (context: LedgerWriteContext) => Promise<void>;
}

const ONLINE_WRITE = { networkMode: 'online', retry: false } as const;

// The write's session is over once the auth session changed (sign-out, sign-in, expiry) or its
// client stopped being a user's cache: a refreshed token of another user (another tab switched the
// account) keeps the session version, but the previous user's client is dropped.
const isCurrent = (client: QueryClient, { sessionVersion }: SessionBound): boolean =>
    isAuthSessionCurrent(sessionVersion) && isUserCacheClient(client);

// A write that failed before its request existed (an amount that cannot be written, an invalid
// path segment) changed nothing on the server.
const wasNeverSent = (error: Error | null): boolean =>
    error instanceof MoneyWireError || error instanceof InvalidPathSegmentError;

// Runs on settle (spec 03 §2.1): after a success, and after a rejected or unanswered request too
// (a 404/409 means the entry on screen is stale; a timed-out write may be committed). A failed
// refresh does not change the write's outcome (the feeds reload on their next focus or mount).
// Only a successful write waits for its refresh: after a network drop the refresh is paused until
// the reconnect, and the failure must not wait with it.
const refreshAfterWrite = (
    effects: LedgerWriteEffects,
    client: QueryClient,
    error: Error | null,
    variables: SessionBound,
    context: LedgerWriteContext,
): Promise<void> | undefined => {
    if (!isCurrent(client, variables) || wasNeverSent(error)) {
        return undefined;
    }
    if (error) {
        void effects.onWriteFailed(context).catch(() => undefined);
        return undefined;
    }
    return effects.onEntryWritten(context).catch(() => undefined);
};

/** `POST /ledger/entries` (an expense, no `id` in the body); a success settles once its views reloaded. */
export const createExpenseMutationOptions = (effects: LedgerWriteEffects) =>
    mutationOptions<void, Error, CreateExpenseVariables>({
        ...ONLINE_WRITE,
        mutationKey: ledgerOnlineMutationKeys.createEntry,
        mutationFn: ({ expense }) =>
            api('post', '/ledger/entries', { body: legacyCreateExpenseBody(expense) }).then(
                () => undefined,
            ),
        onSettled: (_data, error, variables, _context, { client }) =>
            refreshAfterWrite(effects, client, error, variables, {
                groupId: variables.expense.groupId,
                parentActivityId: variables.parentActivityId,
            }),
    });

/** `PATCH /ledger/entries/{id}` (an expense); a success settles once its views reloaded. */
export const updateExpenseMutationOptions = (effects: LedgerWriteEffects) =>
    mutationOptions<void, Error, UpdateExpenseVariables>({
        ...ONLINE_WRITE,
        mutationKey: ledgerOnlineMutationKeys.updateEntry,
        mutationFn: ({ entryId, entry }) =>
            api('patch', '/ledger/entries/{id}', {
                params: { id: entryId },
                body: legacyUpdateExpenseBody(entry),
            }).then(() => undefined),
        onSettled: (_data, error, variables, _context, { client }) =>
            refreshAfterWrite(effects, client, error, variables, {
                groupId: variables.groupId,
                parentActivityId: variables.parentActivityId,
            }),
    });

/** `DELETE /ledger/entries/{id}` (an expense or a settlement); a success settles once its views reloaded. */
export const deleteLedgerEntryMutationOptions = (effects: LedgerWriteEffects) =>
    mutationOptions<void, Error, DeleteLedgerEntryVariables>({
        ...ONLINE_WRITE,
        mutationKey: ledgerOnlineMutationKeys.deleteEntry,
        mutationFn: ({ entryId }) =>
            api('delete', '/ledger/entries/{id}', { params: { id: entryId } }).then(
                () => undefined,
            ),
        onSettled: (_data, error, variables, _context, { client }) =>
            refreshAfterWrite(effects, client, error, variables, {
                groupId: variables.groupId,
                parentActivityId: variables.parentActivityId,
            }),
    });
