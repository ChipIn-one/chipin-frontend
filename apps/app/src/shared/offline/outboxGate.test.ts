import { afterEach, describe, expect, test } from 'vitest';

import { outboxGate } from './outboxGate';

const op = (seq: number, entryId = `entry-${seq}`) => ({ opId: `op-${seq}`, seq, entryId });

// Which of the `whenTurn` promises have resolved, after the pending microtasks ran.
const granted = async (turns: Record<string, Promise<void>>): Promise<string[]> => {
    const done: string[] = [];

    Object.entries(turns).forEach(([name, turn]) => {
        void turn.then(() => done.push(name));
    });
    await Promise.resolve();
    await Promise.resolve();
    return done.sort();
};

afterEach(() => {
    outboxGate.reset();
});

describe('03 §2.4 drain turn', () => {
    test('an adopted op whose run has not reached the gate yet holds back the later ops', async () => {
        outboxGate.adopt(op(1));
        outboxGate.adopt(op(2));
        const second = outboxGate.whenTurn(op(2));

        expect(await granted({ second })).toEqual([]);
        const first = outboxGate.whenTurn(op(1));

        expect(await granted({ first, second })).toEqual(['first']);
        outboxGate.releaseTurn('op-1');
        expect(await granted({ first, second })).toEqual(['first', 'second']);
    });

    test('a Retry of a failed op takes its turn by seq, ignoring its entry block; the later ops of the entry stay blocked', async () => {
        outboxGate.block('entry-x');
        outboxGate.adopt(op(2, 'entry-x'));
        const retried = outboxGate.whenTurn(op(1, 'entry-x'), { ignoreEntryBlock: true });
        const later = outboxGate.whenTurn(op(2, 'entry-x'));

        expect(await granted({ retried, later })).toEqual(['retried']);
        outboxGate.releaseTurn('op-1');
        expect(await granted({ retried, later })).toEqual(['retried']);
        outboxGate.unblock('entry-x');
        expect(await granted({ retried, later })).toEqual(['later', 'retried']);
    });

    test('a closed global reason holds even the op that holds the turn; a skipped op leaves without the slot', async () => {
        const first = outboxGate.whenTurn(op(1));

        expect(await granted({ first })).toEqual(['first']);
        outboxGate.close('auth');
        const again = outboxGate.whenTurn(op(1));
        let skip = false;
        const skipped = outboxGate.whenTurn(op(2), { isSkipped: () => skip });

        expect(await granted({ again, skipped })).toEqual([]);
        skip = true;
        outboxGate.wake();
        expect(await granted({ again, skipped })).toEqual(['skipped']);
        outboxGate.open('auth');
        expect(await granted({ again, skipped })).toEqual(['again', 'skipped']);
    });
});
