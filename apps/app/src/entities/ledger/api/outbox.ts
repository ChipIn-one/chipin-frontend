// The ledger outbox (spec 03 §2.1, 03-15a/b/c): expenses only, persisted in IndexedDB under the write lock,
// behind `VITE_FEATURE_OFFLINE_WRITES` (off: every write takes the online path and nothing of the
// outbox is read or written, as before). With the flag on a user's new client registers the outbox
// defaults and then starts the outbox (`startLedgerOutbox`): the tab reads it and, holding the
// drain lock, adopts and sends it. On the outbox path a write creates no mutation itself: it
// appends an op (the registry checks it is an expense) and the drain tab's adoption creates the
// op's mutation with the outbox key and its defaults. A settlement and
// settle-up never take this path (§2.9).
import { useEffect, useState } from 'react';
import { notifyManager, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getAccessTokenUserId } from 'helpers/authSession';
import { api, ApiError } from 'shared/api/client';
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';
import { hasBroadcastChannel } from 'shared/offline/outboxChannel';
import {
    adoptIfDraining,
    announceOutboxSettled,
    type OutboxDrainHooks,
    startOutboxDrain,
} from 'shared/offline/outboxDrain';
import { hasWebLocks } from 'shared/offline/outboxIo';
import {
    cachedEntryType,
    enqueueOutboxOp,
    type OutboxOpRequest,
    type OutboxOpSeed,
} from 'shared/offline/outboxRegistry';
import {
    type OutboxAdoption,
    type OutboxDeps,
    OutboxEntryGoneError,
    type OutboxResult,
    type OutboxSent,
    runOutboxOp,
} from 'shared/offline/outboxRun';
import { OutboxOpBaseSchema } from 'shared/offline/outboxSchema';
import {
    isOutboxFull,
    isOutboxPersistFailed,
    type OutboxOpBase,
    outboxOwner,
    type OutboxRestore,
    outboxRestoreState,
} from 'shared/offline/outboxStore';
import { userIdOfClient } from 'shared/offline/userCaches';

import {
    type ExpenseDraftWire,
    type ExpensePatchWire,
    toCreateLedgerEntryWire,
    toExpensePatchWire,
} from '../model/toExpenseWire';
import {
    type LedgerEntry,
    optimisticCreatedEntry,
    optimisticUpdatedEntry,
    readLedgerEntry,
} from '../model/toLedgerEntry';

import type {
    CreateExpenseParams,
    DeleteLedgerEntryParams,
    LedgerWriteEffects,
    UpdateExpenseParams,
} from './mutations';
import { type BackendCapability, capabilitiesQueryOptions, ledgerKeys } from './queries';

// Frozen contract after 03-17 (m9): the keys must not be renamed.
export const ledgerOutboxMutationKeys = {
    createExpense: ['ledger', 'outbox', 'createExpense'],
    updateExpense: ['ledger', 'outbox', 'updateExpense'],
    deleteExpense: ['ledger', 'outbox', 'deleteExpense'],
} as const;

/** On every kind: what is read again after the op settles (the group, the open history). */
interface LedgerOpFields {
    readonly groupId: string | null;
    readonly parentActivityId: string | null;
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

// The wire draft and patch are checked as objects: the server validates their fields (a 400 is
// failed `validation`), and they were built by this app's mappers.
const isWireObject = (value: unknown): boolean =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const ledgerOpFields = {
    groupId: z.string().nullable(),
    parentActivityId: z.string().nullable(),
};

/** `OutboxOpSchema` of §2.1 for the ledger: a union by `kind` (`entryKind: 'expense'`, `schema: 1`). */
export const LedgerOutboxOpSchema = z.discriminatedUnion('kind', [
    OutboxOpBaseSchema.extend({
        ...ledgerOpFields,
        kind: z.literal('createExpense'),
        draft: z.custom<ExpenseDraftWire>(isWireObject),
    }),
    OutboxOpBaseSchema.extend({
        ...ledgerOpFields,
        kind: z.literal('updateExpense'),
        baseVersion: z.string().nullable(),
        patch: z.custom<ExpensePatchWire>(isWireObject),
    }),
    OutboxOpBaseSchema.extend({
        ...ledgerOpFields,
        kind: z.literal('deleteExpense'),
        baseVersion: z.string().nullable(),
    }),
]);

// A persisted op is read from IndexedDB: checked with zod before it is adopted or sent.
const isLedgerOutboxOp = (value: unknown): value is LedgerOutboxOp =>
    LedgerOutboxOpSchema.safeParse(value).success;

/** The version an edit or a delete is checked against: ours, else the base; unknown → GET. */
const resolveVersion = (
    op: UpdateExpenseOp | DeleteExpenseOp,
    knownVersion: string | null,
    signal: AbortSignal,
): Promise<string> => {
    const version = knownVersion ?? op.baseVersion;

    if (version !== null) {
        return Promise.resolve(version);
    }
    // §2.1: 200 → a version conflict with that `current`; 404 → failed `deletedRemotely`, except
    // for a delete: the entry is gone, which is what the delete wanted (a no-op, like DELETE 404).
    return api('get', '/ledger/entries/{id}', {
        params: { id: op.entryId },
        expectedTokenSubject: op.owner,
        signal,
    }).then(
        current => {
            throw new ApiError({
                status: 409,
                payload: { code: 'LEDGER.VERSION_CONFLICT' },
                current,
                cause: null,
            });
        },
        (error: unknown) => {
            throw error instanceof ApiError && error.status === 404 && op.kind === 'updateExpense'
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

// `signal`: a release of the drain lock on freeze/pagehide aborts the request (§2.3).
const sendLedgerOutboxOp = (
    op: LedgerOutboxOp,
    knownVersion: string | null,
    signal: AbortSignal,
): Promise<OutboxSent> => {
    switch (op.kind) {
        case 'createExpense':
            return api('post', '/ledger/entries', {
                expectedTokenSubject: op.owner,
                signal,
                body: {
                    type: 'EXPENSE',
                    id: op.entryId,
                    ...(op.groupId !== null && { groupId: op.groupId }),
                    expense: op.draft,
                },
            }).then(entry => ({ version: entry.version, entry }));
        case 'updateExpense':
            return resolveVersion(op, knownVersion, signal)
                .then(version =>
                    api('patch', '/ledger/entries/{id}', {
                        params: { id: op.entryId },
                        expectedTokenSubject: op.owner,
                        signal,
                        headers: opHeaders(op, version),
                        body: { type: 'EXPENSE', expense: op.patch },
                    }),
                )
                .then(entry => ({ version: entry.version, entry }));
        case 'deleteExpense':
            return resolveVersion(op, knownVersion, signal)
                .then(version =>
                    api('delete', '/ledger/entries/{id}', {
                        params: { id: op.entryId },
                        expectedTokenSubject: op.owner,
                        signal,
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
 * `offlineWritesAvailable` of §2.7: the flag, the backend capabilities, Web Locks and
 * `BroadcastChannel` (§2.3), this tab's `outboxRestore === 'ok'` for the client's user, no failed
 * append write this session, and fewer than 50 ops (§2.8). Flag off: nothing is read.
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
    const owner = userIdOfClient(client);

    return (
        OFFLINE_WRITE_CAPABILITIES.every(name => capabilities.includes(name)) &&
        hasWebLocks() &&
        hasBroadcastChannel() &&
        owner !== null &&
        outboxRestoreState(owner) === 'ok' &&
        !isOutboxPersistFailed() &&
        !isOutboxFull()
    );
};

/**
 * `isOfflineWriteAvailable` for a component, read again on every query cache change (the
 * capabilities are fetched once when missing). Flag off: false, nothing is read or fetched.
 */
export const useIsOfflineWriteAvailable = (): boolean => {
    const client = useQueryClient();
    const [isAvailable, setIsAvailable] = useState(false);

    useEffect(() => {
        if (!isOfflineWritesFlagOn()) {
            return undefined;
        }
        const capabilitiesKey = capabilitiesQueryOptions().queryKey;
        // Only with the capabilities cached: a missing one is fetched once here, not on every change.
        const check = (): void => {
            setIsAvailable(
                client.getQueryData(capabilitiesKey) !== undefined &&
                    isOfflineWriteAvailable(client),
            );
        };

        void client.prefetchQuery(capabilitiesQueryOptions());
        check();
        // Deferred: a cache change may come from another component's render.
        return client.getQueryCache().subscribe(notifyManager.batchCalls(check));
    }, [client]);

    return isAvailable;
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

const registeredClients = new WeakSet<QueryClient>();

// §2.2/§2.5 2xx: the answered entry (with its new version) into `ledger.entry(id)` before the
// invalidation, so the next edit appended here is based on it. A read in flight is cancelled first:
// its older answer must not land over this one (R1 L1). A deleted entry, and an answer without a
// readable version (R1 L2: neither the optimistic nor an older version may stay), leave the cache.
const writeAnsweredEntry = (
    client: QueryClient,
    op: LedgerOutboxOp,
    entry: unknown,
): Promise<void> => {
    const queryKey = ledgerKeys.entry(op.entryId);
    const answered = op.kind === 'deleteExpense' ? null : readLedgerEntry(entry);

    return client
        .cancelQueries({ queryKey, exact: true })
        .catch(() => undefined)
        .then(() => {
            if (answered) {
                client.setQueryData<LedgerEntry>(queryKey, answered);
            } else {
                client.removeQueries({ queryKey, exact: true });
            }
        });
};

// What is read again after the op settled (`invalidateAfterLedgerOp`): its views and its entry.
const opContext = (op: LedgerOutboxOp) => ({
    groupId: op.groupId ?? undefined,
    parentActivityId: op.parentActivityId ?? undefined,
    entryId: op.entryId,
});

/**
 * The outbox mutation defaults (§2.1), every callback included: a restored mutation has only
 * these. `networkMode: 'always'` and `retry: false`: `runOutboxOp` waits and retries itself
 * (owner item 35). No `scope`: the order is the drain turn. Once per client.
 */
export const registerLedgerOutboxDefaults = (
    client: QueryClient,
    effects: LedgerWriteEffects,
): void => {
    if (registeredClients.has(client)) {
        return;
    }
    registeredClients.add(client);
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
                    void client.invalidateQueries({
                        queryKey: ledgerKeys.entry(variables.entryId),
                    });
                }
            },
            // `stopped`/`cancelled` changed nothing on the server: nothing to read again. The other
            // tabs run the same effects on `settled` (§2.2).
            onSettled: (result, error, variables) => {
                if (!isLedgerOutboxOp(variables) || (!error && result?.kind !== 'sent')) {
                    return undefined;
                }
                const entry = result?.kind === 'sent' ? result.entry : null;
                const refresh = error ? effects.onWriteFailed : effects.onEntryWritten;

                return (error ? Promise.resolve() : writeAnsweredEntry(client, variables, entry))
                    .then(() => {
                        announceOutboxSettled(variables, error ? 'failed' : 'sent', entry);
                        return refresh(opContext(variables), client);
                    })
                    .catch(() => undefined);
            },
        });
    });
};

const ledgerAdoption = (client: QueryClient): OutboxAdoption => ({
    mutationKeyFor: kind => ledgerOutboxMutationKeys[kind],
    isAcceptable: op => isAcceptableLedgerOp(client, op),
    sessionUserId: () => getAccessTokenUserId(),
});

// §2.2 in a tab that does not drain: the effects of another tab's settled op of this owner. The
// answered entry is written first, so the next edit appended here is based on its version (no
// false 409); a fresher entry read later (a refetch) replaces it (03-15c2 R1 L3).
const ledgerDrainHooks = (
    client: QueryClient,
    userId: string,
    effects: LedgerWriteEffects,
): OutboxDrainHooks => ({
    ...ledgerAdoption(client),
    onRemoteSettled: ({ op, result, entry }) => {
        if (!isLedgerOutboxOp(op) || op.owner !== userId) {
            return;
        }
        if (result === 'sent') {
            void writeAnsweredEntry(client, op, entry)
                .then(() => effects.onEntryWritten(opContext(op), client))
                .catch(() => undefined);
            return;
        }
        void client.invalidateQueries({ queryKey: ledgerKeys.entry(op.entryId) });
        void effects.onWriteFailed(opContext(op), client).catch(() => undefined);
    },
});

/**
 * Starts the outbox of the user's new client (§2.1, §2.3; `bootstrap` wires it to `clientFor`):
 * the defaults are registered first, then the tab reads the outbox and requests the drain lock;
 * holding it, the persisted ops are hydrated as paused mutations and resumed (`restoreOutbox`).
 * Flag off: nothing is registered, read or written, no lock is requested and no channel opened.
 */
export const startLedgerOutbox = (
    client: QueryClient,
    userId: string,
    effects: LedgerWriteEffects,
): Promise<OutboxRestore> => {
    if (!isOfflineWritesFlagOn()) {
        return Promise.resolve('pending');
    }
    registerLedgerOutboxDefaults(client, effects);
    return startOutboxDrain(client, userId, ledgerDrainHooks(client, userId, effects));
};

/** The optimistic entry of a queued op from the cached one; undefined: the cache is left as is. */
type OptimisticEntry = (cached: LedgerEntry | undefined) => LedgerEntry | undefined;

// Any tab appends (§2.3): the drain tab adopts its own op at once, the others learn it by the
// `changed` ping. The path choice required this tab's restored outbox of the client's user. Once
// the append write resolved, this tab writes the optimistic entry (§2.2: no snapshot; the other
// tabs show the op through the overlay).
const enqueueLedgerOp = <Op extends LedgerOutboxOp>(
    client: QueryClient,
    target: Omit<OutboxOpRequest, 'owner'>,
    build: (seed: OutboxOpSeed) => Op,
    optimistic?: OptimisticEntry,
): Promise<void> => {
    const owner = userIdOfClient(client);

    if (owner === null || owner !== outboxOwner()) {
        return Promise.reject(new Error('No signed-in user client'));
    }
    const queryKey = ledgerKeys.entry(target.entryId);

    // The optimistic entry is written before this tab adopts the op, so the op's 2xx always
    // lands after it.
    return enqueueOutboxOp(client, { ...target, owner }, build)
        .then(() =>
            optimistic
                ? client.cancelQueries({ queryKey, exact: true }).catch(() => undefined)
                : undefined,
        )
        .then(() => {
            try {
                if (optimistic) {
                    client.setQueryData<LedgerEntry>(queryKey, optimistic);
                }
            } finally {
                adoptIfDraining();
            }
        });
};

/** Queues the write in the outbox; one call = one op (one client entry id for a create). */
export type QueueLedgerWrite = () => Promise<void>;

/** The outbox path of an expense create, or null for the online path. */
export const createExpenseViaOutbox = (
    client: QueryClient,
    { expense, parentActivityId, clientEntryId }: CreateExpenseParams,
): QueueLedgerWrite | null =>
    chooseLedgerWritePath(client, { kind: 'create' }) !== 'outbox'
        ? null
        : () => {
              // §2.7: the client entry id made at the form's opening (a repeated submit of the
              // form carries it, and its create is queued once); a new one without a form.
              const entryId = clientEntryId ?? crypto.randomUUID();

              return Promise.resolve()
                  .then(() => toCreateLedgerEntryWire(expense, { clientEntryId: entryId }))
                  .then(wire =>
                      enqueueLedgerOp(
                          client,
                          { kind: 'createExpense', entryId },
                          ({ base }) => ({
                              ...base,
                              kind: 'createExpense',
                              groupId: wire.groupId ?? null,
                              parentActivityId: parentActivityId ?? null,
                              draft: wire.expense,
                          }),
                          cached => cached ?? optimisticCreatedEntry(entryId, expense),
                      ),
                  );
          };

/** The outbox path of an expense edit, or null for the online path. */
export const updateExpenseViaOutbox = (
    client: QueryClient,
    { entryId, entry, groupId, parentActivityId }: UpdateExpenseParams,
): QueueLedgerWrite | null =>
    chooseLedgerWritePath(client, { kind: 'update', entryId }) !== 'outbox'
        ? null
        : () =>
              Promise.resolve()
                  .then(() => toExpensePatchWire(entry))
                  .then(patch =>
                      enqueueLedgerOp(
                          client,
                          { kind: 'updateExpense', entryId },
                          ({ base, baseVersion }) => ({
                              ...base,
                              kind: 'updateExpense',
                              groupId: groupId ?? null,
                              parentActivityId: parentActivityId ?? null,
                              baseVersion,
                              patch,
                          }),
                          cached => (cached ? optimisticUpdatedEntry(cached, entry) : undefined),
                      ),
                  );

/** The outbox path of an expense delete, or null (a settlement, or offline writes off). */
export const deleteExpenseViaOutbox = (
    client: QueryClient,
    { entryId, groupId, parentActivityId }: DeleteLedgerEntryParams,
): QueueLedgerWrite | null =>
    chooseLedgerWritePath(client, { kind: 'delete', entryId }) !== 'outbox'
        ? null
        : () =>
              enqueueLedgerOp(
                  client,
                  { kind: 'deleteExpense', entryId },
                  ({ base, baseVersion }) => ({
                      ...base,
                      kind: 'deleteExpense',
                      groupId: groupId ?? null,
                      parentActivityId: parentActivityId ?? null,
                      baseVersion,
                  }),
              );
