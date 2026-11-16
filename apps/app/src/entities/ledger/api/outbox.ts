// The ledger outbox (spec 03 §2.1, 03-15a): expenses only, one tab, in memory, behind
// `VITE_FEATURE_OFFLINE_WRITES` (off: every write takes the online path, as before). On the outbox
// path a write creates no mutation itself: it appends an op (the registry checks it is an
// expense) and the adoption creates the op's mutation with the outbox key and its defaults. A
// settlement and settle-up never take this path (§2.9).
import type { QueryClient } from '@tanstack/react-query';

import { getAccessTokenUserId } from 'helpers/authSession';
import { api, ApiError } from 'shared/api/client';
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';
import {
    cachedEntryType,
    enqueueOutboxOp,
    ledgerEntryKey,
    type OutboxOpRequest,
    type OutboxOpSeed,
} from 'shared/offline/outboxRegistry';
import {
    adoptOutboxOps,
    type OutboxDeps,
    OutboxEntryGoneError,
    type OutboxResult,
    type OutboxSent,
    runOutboxOp,
} from 'shared/offline/outboxRun';
import { type OutboxOpBase, startOutbox } from 'shared/offline/outboxStore';
import { userIdOfClient } from 'shared/offline/userCaches';

import {
    type ExpenseDraftWire,
    type ExpensePatchWire,
    toCreateLedgerEntryWire,
    toExpensePatchWire,
} from '../model/toExpenseWire';

import type {
    CreateExpenseParams,
    DeleteLedgerEntryParams,
    LedgerWriteEffects,
    UpdateExpenseParams,
} from './mutations';
import { type BackendCapability, capabilitiesQueryOptions } from './queries';

// Frozen contract after 03-17 (m9): the keys must not be renamed.
export const ledgerOutboxMutationKeys = {
    createExpense: ['ledger', 'outbox', 'createExpense'],
    updateExpense: ['ledger', 'outbox', 'updateExpense'],
    deleteExpense: ['ledger', 'outbox', 'deleteExpense'],
} as const;

/** `groupId` on every kind: what is read again after the op settles. */
interface LedgerOpFields {
    readonly groupId: string | null;
}

export type CreateExpenseOp = OutboxOpBase &
    LedgerOpFields & { readonly kind: 'createExpense'; readonly draft: ExpenseDraftWire };
export type UpdateExpenseOp = OutboxOpBase &
    LedgerOpFields & {
        readonly kind: 'updateExpense';
        readonly baseVersion: string | null;
        readonly patch: ExpensePatchWire;
    };
export type DeleteExpenseOp = OutboxOpBase &
    LedgerOpFields & { readonly kind: 'deleteExpense'; readonly baseVersion: string | null };
export type LedgerOutboxOp = CreateExpenseOp | UpdateExpenseOp | DeleteExpenseOp;

const OUTBOX_KINDS: readonly unknown[] = Object.keys(ledgerOutboxMutationKeys);

// The ops are this tab's own objects until 03-15b validates the persisted ones with zod.
const isLedgerOutboxOp = (value: unknown): value is LedgerOutboxOp =>
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    OUTBOX_KINDS.includes(value.kind) &&
    'opId' in value &&
    'entryId' in value;

/** The version an edit or a delete is checked against: ours, else the base; unknown → GET. */
const resolveVersion = (
    op: UpdateExpenseOp | DeleteExpenseOp,
    knownVersion: string | null,
): Promise<string> => {
    const version = knownVersion ?? op.baseVersion;

    if (version !== null) {
        return Promise.resolve(version);
    }
    // §2.1: 200 → a version conflict with that `current`; 404 → failed `deletedRemotely`.
    return api('get', '/ledger/entries/{id}', { params: { id: op.entryId } }).then(
        current => {
            throw new ApiError({
                status: 409,
                payload: { code: 'LEDGER.VERSION_CONFLICT' },
                current,
                cause: null,
            });
        },
        (error: unknown) => {
            throw error instanceof ApiError && error.status === 404
                ? new OutboxEntryGoneError()
                : error;
        },
    );
};

// PATCH/DELETE never go out of the outbox without `If-Match`; the op id makes a resend idempotent.
const opHeaders = (op: LedgerOutboxOp, version: string): Record<string, string> => ({
    'If-Match': `"${version}"`,
    'X-Client-Op-Id': op.opId,
});

const sendLedgerOutboxOp = (
    op: LedgerOutboxOp,
    knownVersion: string | null,
): Promise<OutboxSent> => {
    switch (op.kind) {
        case 'createExpense':
            return api('post', '/ledger/entries', {
                body: {
                    type: 'EXPENSE',
                    id: op.entryId,
                    ...(op.groupId !== null && { groupId: op.groupId }),
                    expense: op.draft,
                },
            }).then(entry => ({ version: entry.version, entry }));
        case 'updateExpense':
            return resolveVersion(op, knownVersion)
                .then(version =>
                    api('patch', '/ledger/entries/{id}', {
                        params: { id: op.entryId },
                        headers: opHeaders(op, version),
                        body: { type: 'EXPENSE', expense: op.patch },
                    }),
                )
                .then(entry => ({ version: entry.version, entry }));
        case 'deleteExpense':
            return resolveVersion(op, knownVersion)
                .then(version =>
                    api('delete', '/ledger/entries/{id}', {
                        params: { id: op.entryId },
                        headers: opHeaders(op, version),
                    }),
                )
                .then(() => ({ version: null, entry: null }));
    }
};

const ledgerOutboxDeps: OutboxDeps<LedgerOutboxOp> = {
    send: sendLedgerOutboxOp,
    // Read on each send (not bound at import): the session can change between sends.
    sessionUserId: () => getAccessTokenUserId(),
};

const OFFLINE_WRITE_CAPABILITIES: readonly BackendCapability[] = [
    'ledger.clientEntryId',
    'ledger.entryVersion',
    'client.minVersion',
];

/**
 * `offlineWritesAvailable` of §2.7 as far as 03-15a goes: the flag and the backend capabilities
 * (03-15b/c add the restore, Web Locks and storage conditions). Flag off: nothing is read.
 */
export const isOfflineWriteAvailable = (client: QueryClient): boolean => {
    if (!isOfflineWritesFlagOn()) {
        return false;
    }
    const capabilities = client.getQueryData(capabilitiesQueryOptions().queryKey);

    if (!capabilities) {
        void client.prefetchQuery(capabilitiesQueryOptions());
        return false;
    }
    return OFFLINE_WRITE_CAPABILITIES.every(name => capabilities.includes(name));
};

export type LedgerWritePath = 'online' | 'outbox';

export type LedgerWriteTarget = { kind: 'create' } | { kind: 'update' | 'delete'; entryId: string };

/** §2.1: the outbox only for an expense (a cached `EXPENSE` entry for an edit or a delete). */
export const chooseLedgerWritePath = (
    client: QueryClient,
    target: LedgerWriteTarget,
): LedgerWritePath =>
    isOfflineWriteAvailable(client) &&
    (target.kind === 'create' || cachedEntryType(client, target.entryId) === 'EXPENSE')
        ? 'outbox'
        : 'online';

/** Also checked on adoption (C2-02): an expense op, and not an entry cached as a settlement. */
const isAcceptableLedgerOp = (client: QueryClient, op: OutboxOpBase): boolean => {
    const entryKind: string = op.entryKind;

    return (
        isLedgerOutboxOp(op) &&
        entryKind === 'expense' &&
        (op.kind === 'createExpense' || cachedEntryType(client, op.entryId) !== 'SETTLEMENT')
    );
};

/**
 * The outbox mutation defaults (§2.1), every callback included: after 03-15b a restored mutation
 * has only these. `networkMode: 'always'` and `retry: false`: `runOutboxOp` waits and retries
 * itself (owner item 35). No `scope`: the order is the drain turn.
 */
export const registerLedgerOutboxDefaults = (
    client: QueryClient,
    effects: LedgerWriteEffects,
): void => {
    Object.values(ledgerOutboxMutationKeys).forEach(mutationKey => {
        client.setMutationDefaults<OutboxResult, Error, unknown>(mutationKey, {
            mutationFn: variables =>
                isLedgerOutboxOp(variables)
                    ? runOutboxOp(variables, ledgerOutboxDeps)
                    : Promise.reject(new Error('Not a ledger outbox op')),
            networkMode: 'always',
            retry: false,
            meta: { outbox: true },
            // A final error: the entry on screen may be stale.
            onError: (_error, variables) => {
                if (isLedgerOutboxOp(variables)) {
                    void client.invalidateQueries({ queryKey: ledgerEntryKey(variables.entryId) });
                }
            },
            // `stopped`/`cancelled` changed nothing on the server: nothing to read again.
            onSettled: (result, error, variables) => {
                if (!isLedgerOutboxOp(variables) || (!error && result?.kind !== 'sent')) {
                    return undefined;
                }
                const context = { groupId: variables.groupId ?? undefined };
                const refresh = error ? effects.onWriteFailed : effects.onEntryWritten;

                return refresh(context, client).catch(() => undefined);
            },
        });
    });
};

const registeredClients = new WeakSet<QueryClient>();

// One tab, in memory: the tab that appends is the tab that drains (03-15c: the drain lock).
const enqueueLedgerOp = <Op extends LedgerOutboxOp>(
    client: QueryClient,
    effects: LedgerWriteEffects,
    target: Omit<OutboxOpRequest, 'owner'>,
    build: (seed: OutboxOpSeed) => Op,
): Promise<void> => {
    const owner = userIdOfClient(client);

    if (owner === null) {
        return Promise.reject(new Error('No signed-in user client'));
    }
    if (!registeredClients.has(client)) {
        registerLedgerOutboxDefaults(client, effects);
        registeredClients.add(client);
    }
    startOutbox(owner);
    return enqueueOutboxOp(client, { ...target, owner }, build).then(() => {
        adoptOutboxOps(
            client,
            kind => ledgerOutboxMutationKeys[kind],
            op => isAcceptableLedgerOp(client, op),
        );
    });
};

/** The outbox path of an expense create, or null for the online path. */
export const createExpenseViaOutbox = (
    client: QueryClient,
    effects: LedgerWriteEffects,
    { expense }: CreateExpenseParams,
): Promise<void> | null => {
    if (chooseLedgerWritePath(client, { kind: 'create' }) !== 'outbox') {
        return null;
    }
    // §2.7: the client entry id (03-16a moves it to the form's opening, for a repeated submit).
    const entryId = crypto.randomUUID();

    return Promise.resolve()
        .then(() => toCreateLedgerEntryWire(expense, { clientEntryId: entryId }))
        .then(wire =>
            enqueueLedgerOp(client, effects, { kind: 'createExpense', entryId }, ({ base }) => ({
                ...base,
                kind: 'createExpense',
                groupId: wire.groupId ?? null,
                draft: wire.expense,
            })),
        );
};

/** The outbox path of an expense edit, or null for the online path. */
export const updateExpenseViaOutbox = (
    client: QueryClient,
    effects: LedgerWriteEffects,
    { entryId, entry, groupId }: UpdateExpenseParams,
): Promise<void> | null => {
    if (chooseLedgerWritePath(client, { kind: 'update', entryId }) !== 'outbox') {
        return null;
    }
    return Promise.resolve()
        .then(() => toExpensePatchWire(entry))
        .then(patch =>
            enqueueLedgerOp(
                client,
                effects,
                { kind: 'updateExpense', entryId },
                ({ base, baseVersion }) => ({
                    ...base,
                    kind: 'updateExpense',
                    groupId: groupId ?? null,
                    baseVersion,
                    patch,
                }),
            ),
        );
};

/** The outbox path of an expense delete, or null (a settlement, or offline writes off). */
export const deleteExpenseViaOutbox = (
    client: QueryClient,
    effects: LedgerWriteEffects,
    { entryId, groupId }: DeleteLedgerEntryParams,
): Promise<void> | null =>
    chooseLedgerWritePath(client, { kind: 'delete', entryId }) === 'outbox'
        ? enqueueLedgerOp(
              client,
              effects,
              { kind: 'deleteExpense', entryId },
              ({ base, baseVersion }) => ({
                  ...base,
                  kind: 'deleteExpense',
                  groupId: groupId ?? null,
                  baseVersion,
              }),
          )
        : null;
