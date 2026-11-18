// Spec 03 §2.9: "the constant ONLINE_ONLY_ACTIONS + a test that every action is wrapped". Every key
// is used by at least one entry point in production code: `<OnlineOnly action={…}>`,
// `<OnlineOnlyGroup action={…}>` or `useRequiresOnline(…)`, outside this definition and the tests.
import { describe, expect, test } from 'vitest';

import { ONLINE_ONLY_ACTIONS } from './onlineOnlyActions';

const sources = import.meta.glob<string>(
    ['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!./onlineOnlyActions.ts'],
    { query: '?raw', import: 'default', eager: true },
);

// `action={ONLINE_ONLY_ACTIONS.x}` (a conditional expression without braces counts) and
// `useRequiresOnline(ONLINE_ONLY_ACTIONS.x)`.
const ENTRY_POINT =
    /(?:\baction=\{[^{}]*?ONLINE_ONLY_ACTIONS\.(\w+)|\buseRequiresOnline\(\s*ONLINE_ONLY_ACTIONS\.(\w+))/g;

const usedKeys = (): Map<string, string[]> => {
    const used = new Map<string, string[]>();

    Object.entries(sources).forEach(([path, source]) => {
        for (const match of source.matchAll(ENTRY_POINT)) {
            const key = match[1] ?? match[2];

            if (key !== undefined) {
                used.set(key, [...(used.get(key) ?? []), path]);
            }
        }
    });
    return used;
};

describe('ONLINE_ONLY_ACTIONS: every action has a wrapped entry point (§2.9)', () => {
    const used = usedKeys();

    test('the scan reads the sources', () => {
        expect(Object.keys(sources).length).toBeGreaterThan(100);
    });

    test.each(Object.keys(ONLINE_ONLY_ACTIONS))('%s', key => {
        expect(used.get(key) ?? []).not.toEqual([]);
    });

    test('no entry point names an action that does not exist', () => {
        expect([...used.keys()].filter(key => !(key in ONLINE_ONLY_ACTIONS))).toEqual([]);
    });

    test('§2.9 C2-02: settlement delete and edit are wrapped in the expense history', () => {
        const history = Object.entries(sources).find(([path]) =>
            path.endsWith('/ActivitySubeventsButtons.tsx'),
        )?.[1];

        expect(history).toContain('action={ONLINE_ONLY_ACTIONS.settlementDelete}');
        expect(history).toContain('action={ONLINE_ONLY_ACTIONS.settlementEdit}');
    });
});
