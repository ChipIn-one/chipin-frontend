// The conflict drafts of the expense outbox (spec 03 §2.6, D28, 03-16b): the user's changes of an
// expense the server answered 409 for stay as a draft until the user saves them from the edit form
// or discards them. The notices (the conflict toasts, "The expense was deleted") are told to a
// listener the UI mounts with offline writes on; with the flag off nothing here reads or writes.
import { useEffect } from 'react';

import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';
import { reportOutboxWriteFailure } from 'shared/offline/outboxRun';
import { dropConflictDraft, outboxConflictDraft } from 'shared/offline/outboxStore';

import { fromExpensePatchWire } from '../model/toExpenseWire';
import type { ExpensePatch } from '../model/types';

/**
 * `changed`: an edit conflicted, its changes are a draft (`offline:conflictChanged`, "Open my
 * changes"); `notDeleted`: a delete conflicted and was dropped (`offline:conflictNotDeleted`);
 * `deleted`: the entry of a draft is gone, the draft was dropped ("The expense was deleted").
 */
export interface LedgerConflictNotice {
    readonly kind: 'changed' | 'notDeleted' | 'deleted';
    readonly entryId: string;
    /** The expense history the draft reopens in; null when unknown. */
    readonly parentActivityId: string | null;
}

const listeners = new Set<(notice: LedgerConflictNotice) => void>();

/** Tells the mounted listeners (none: nothing happens). */
export const noticeLedgerConflict = (notice: LedgerConflictNotice): void => {
    listeners.forEach(listener => listener(notice));
};

/**
 * A draft write that failed (R1 N3, invariant 7): reported like every outbox write failure (a
 * refused write of a stopped outbox is not one; a lock timeout and an IDB error are).
 */
export const reportConflictDraftFailure = (error: unknown): void => {
    reportOutboxWriteFailure(error);
};

/** Listens to the conflict notices; returns the unsubscribe. */
export const onLedgerConflictNotice = (
    listener: (notice: LedgerConflictNotice) => void,
): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/** The UI's conflict notices (the toasts); flag off: nothing is subscribed. */
export const useLedgerConflictNotices = (
    listener: (notice: LedgerConflictNotice) => void,
): void => {
    useEffect(
        () => (isOfflineWritesFlagOn() ? onLedgerConflictNotice(listener) : undefined),
        [listener],
    );
};

/**
 * "Discard my changes" (§2.6), or the Save of the form when it went online: removes the entry's
 * draft under the write lock, no request. Resolves whether one was removed; flag off, or no draft
 * in this tab's last read: false, nothing is read or written.
 */
export const discardConflictDraft = (entryId: string): Promise<boolean> =>
    isOfflineWritesFlagOn() && outboxConflictDraft(entryId) !== null
        ? dropConflictDraft(entryId)
        : Promise.resolve(false);

/**
 * §2.6: the entry of a draft is gone (a 404 on `ledger.entry(id)`, a reversed expense in its
 * history): whichever tab sees it drops the draft (idempotent) and says so once.
 */
export const dropDeletedConflictDraft = (entryId: string): Promise<void> => {
    const draft = isOfflineWritesFlagOn() ? outboxConflictDraft(entryId) : null;

    if (draft === null) {
        return Promise.resolve();
    }
    return dropConflictDraft(entryId).then(isDropped => {
        if (isDropped) {
            noticeLedgerConflict({
                kind: 'deleted',
                entryId,
                parentActivityId: draft.parentActivityId,
            });
        }
    }, reportConflictDraftFailure);
};

/** Whether the entry has a conflict draft in this tab's last read (flag off: never). */
export const hasConflictDraft = (entryId: string): boolean =>
    isOfflineWritesFlagOn() && outboxConflictDraft(entryId) !== null;

/**
 * The entry's draft as a domain patch for the edit form (amounts in the draft's currency, else
 * `fallbackCurrency`); null without a draft or when its fields are not readable.
 */
export const conflictDraftPatch = (
    entryId: string,
    fallbackCurrency: string,
): ExpensePatch | null => {
    const draft = isOfflineWritesFlagOn() ? outboxConflictDraft(entryId) : null;

    return draft ? fromExpensePatchWire(draft.fields, fallbackCurrency) : null;
};
