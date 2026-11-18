// Spec 03 §2.6 (03-16b R2): the conflict notices reach the UI even when told before it listens.
import * as Sentry from '@sentry/react';
import { expect, test, vi } from 'vitest';

import {
    type LedgerConflictNotice,
    noticeLedgerConflict,
    onLedgerConflictNotice,
} from './conflictDrafts';

vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const notice = (entryId: string): LedgerConflictNotice => ({
    kind: 'notDeleted',
    entryId,
    parentActivityId: null,
});

test('R2-L2: a notice told before any listener is delivered to the first one, once', () => {
    noticeLedgerConflict(notice('entry-a'));
    const first: LedgerConflictNotice[] = [];
    const second: LedgerConflictNotice[] = [];
    const stopFirst = onLedgerConflictNotice(item => first.push(item));
    const stopSecond = onLedgerConflictNotice(item => second.push(item));

    noticeLedgerConflict(notice('entry-b'));

    expect(first.map(({ entryId }) => entryId)).toEqual(['entry-a', 'entry-b']);
    expect(second.map(({ entryId }) => entryId)).toEqual(['entry-b']);
    stopFirst();
    stopSecond();
});

test('R2-N2: a throwing listener is reported and the others still get the notice', () => {
    const got: string[] = [];
    const stopThrowing = onLedgerConflictNotice(() => {
        throw new Error('listener');
    });
    const stop = onLedgerConflictNotice(item => got.push(item.entryId));

    noticeLedgerConflict(notice('entry-c'));

    expect(got).toEqual(['entry-c']);
    expect(Sentry.captureException).toHaveBeenCalledOnce();
    stopThrowing();
    stop();
});
