// The ledger entity mutations (spec 03 §2.1, §6 row 6): create and update an expense, delete a
// ledger entry (an expense or a settlement: one endpoint, spec 03 §2.9). Online only: no outbox,
// no retry, and the hooks refuse them offline before `mutate`. The keys are the online set of
// spec 03 §2.1; the outbox set and `registerLedgerMutationDefaults` arrive with 03-15a.
//
// Nothing is written into a cache here (the server is the source of truth for finances): after a
// successful write, what shows the entry is read again. Until the activity feed and the ledger
// entry are queries, that refresh is passed in (`LedgerWriteEffects`): entities never import
// `store`. A write whose auth session has ended (a sign-out, an account switch, an expired
// session) refreshes nothing.
import { mutationOptions } from '@tanstack/react-query';

import type { CreateLedgerEntryParams, UpdateLedgerExpenseParams } from 'api/chipin.types';
import { isAuthSessionCurrent } from 'helpers/authSession';
import { api } from 'shared/api/client';

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
    /** Reads again what shows the entry; the write settles when it has. */
    onEntryWritten: (context: LedgerWriteContext) => Promise<void>;
}

const ONLINE_WRITE = { networkMode: 'online', retry: false } as const;

// The write is done on the server whatever the refresh does: a failed refresh does not fail it
// (the feeds reload on their next focus or mount).
const refreshAfterWrite = (
    effects: LedgerWriteEffects,
    { sessionVersion }: SessionBound,
    context: LedgerWriteContext,
): Promise<void> | undefined =>
    isAuthSessionCurrent(sessionVersion)
        ? effects.onEntryWritten(context).catch(() => undefined)
        : undefined;

/** `POST /ledger/entries` (an expense, no `id` in the body); settles once its views reloaded. */
export const createExpenseMutationOptions = (effects: LedgerWriteEffects) =>
    mutationOptions<void, Error, CreateExpenseVariables>({
        ...ONLINE_WRITE,
        mutationKey: ledgerOnlineMutationKeys.createEntry,
        mutationFn: ({ expense }) =>
            api('post', '/ledger/entries', { body: legacyCreateExpenseBody(expense) }).then(
                () => undefined,
            ),
        onSuccess: (_data, variables) =>
            refreshAfterWrite(effects, variables, {
                groupId: variables.expense.groupId,
                parentActivityId: variables.parentActivityId,
            }),
    });

/** `PATCH /ledger/entries/{id}` (an expense); settles once its views reloaded. */
export const updateExpenseMutationOptions = (effects: LedgerWriteEffects) =>
    mutationOptions<void, Error, UpdateExpenseVariables>({
        ...ONLINE_WRITE,
        mutationKey: ledgerOnlineMutationKeys.updateEntry,
        mutationFn: ({ entryId, entry }) =>
            api('patch', '/ledger/entries/{id}', {
                params: { id: entryId },
                body: legacyUpdateExpenseBody(entry),
            }).then(() => undefined),
        onSuccess: (_data, variables) =>
            refreshAfterWrite(effects, variables, {
                groupId: variables.groupId,
                parentActivityId: variables.parentActivityId,
            }),
    });

/** `DELETE /ledger/entries/{id}` (an expense or a settlement); settles once its views reloaded. */
export const deleteLedgerEntryMutationOptions = (effects: LedgerWriteEffects) =>
    mutationOptions<void, Error, DeleteLedgerEntryVariables>({
        ...ONLINE_WRITE,
        mutationKey: ledgerOnlineMutationKeys.deleteEntry,
        mutationFn: ({ entryId }) =>
            api('delete', '/ledger/entries/{id}', { params: { id: entryId } }).then(
                () => undefined,
            ),
        onSuccess: (_data, variables) =>
            refreshAfterWrite(effects, variables, {
                groupId: variables.groupId,
                parentActivityId: variables.parentActivityId,
            }),
    });
