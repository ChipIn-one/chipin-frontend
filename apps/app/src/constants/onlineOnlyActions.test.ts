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

// R1 L6: not one entry point per action, every one. Each JSX usage of an online-only trigger
// component, and each caller of an online-only mutation hook, must sit behind a wrapper.
describe('every entry point of an online-only action is wrapped (§2.9)', () => {
    const GUARD = /<OnlineOnly(?:Group)?\s+action=\{|useRequiresOnline\(\s*ONLINE_ONLY_ACTIONS\./;
    const isGuarded = (source: string): boolean => GUARD.test(source);
    const nameOf = (path: string): string => path.replace(/^.*\//, '').replace(/\.tsx?$/, '');
    const fileOf = (name: string): string | undefined =>
        Object.keys(sources).find(path => nameOf(path) === name);
    const sourceOf = (path: string): string => sources[path] ?? '';

    /** Modals whose children are their trigger: every child must be `<OnlineOnly action=…>`. */
    const TRIGGER_MODALS = [
        'CreateUpdateGroupModal',
        'LeaveGroupAlertDialog',
        'RemoveGroupAlertDialog',
        'KickGroupMemberAlertDialog',
        'UserAvatarModal',
    ];
    /** Opened by the caller's state: the calling file reads `useRequiresOnline`. */
    const CONTROLLED_MODALS = ['RemoveFriendAlertDialog', 'SettleUpModal'];
    /** Their own action button is wrapped inside them. */
    const SELF_WRAPPED = ['GroupSettleUpFlow', 'InviteJoinConfirmation'];
    /** Development only (not in a production build's UI). */
    const EXEMPT = ['DevMenu'];
    const ONLINE_ONLY_HOOKS = [
        'useCreateGroup',
        'useUpdateGroup',
        'useUploadGroupCover',
        'useJoinGroup',
        'useLeaveGroup',
        'useKickGroupMember',
        'useRemoveGroup',
        'useUpdateSelf',
        'useUploadAvatar',
        'useRemoveKnownUser',
        'useAcceptFriendInvite',
        'useCreateSettlement',
        'logoutOtherDevices',
    ];
    const DEFINITIONS =
        /\/(?:hooks\/use(?:Group|User|Ledger)Mutations\.ts|store\/|api\/|helpers\/)/;

    interface Usage {
        readonly path: string;
        readonly openTag: string;
        /** The children, null for a self-closing usage. */
        readonly body: string | null;
    }

    // Every `<Name …>` in the sources outside its own file; the opening tag is read brace-aware.
    const usagesOf = (name: string): Usage[] =>
        Object.entries(sources).flatMap(([path, source]) => {
            if (nameOf(path) === name) {
                return [];
            }
            const usages: Usage[] = [];
            const opening = new RegExp(`<${name}(?![\\w.])`, 'g');

            for (const match of source.matchAll(opening)) {
                let depth = 0;
                let end = match.index + match[0].length;

                for (; end < source.length; end += 1) {
                    const char = source[end];

                    if (char === '{') {
                        depth += 1;
                    } else if (char === '}') {
                        depth -= 1;
                    } else if (char === '>' && depth === 0) {
                        break;
                    }
                }
                const openTag = source.slice(match.index, end + 1);
                const close = source.indexOf(`</${name}>`, end);

                usages.push({
                    path,
                    openTag,
                    body: openTag.endsWith('/>') ? null : source.slice(end + 1, close),
                });
            }
            return usages;
        });

    const WRAPPED_CHILD = /^\s*<OnlineOnly\s+action=\{ONLINE_ONLY_ACTIONS\.\w+\}/;

    test.each(TRIGGER_MODALS)('%s: every trigger child is <OnlineOnly action>', name => {
        const usages = usagesOf(name);

        expect(usages.length).toBeGreaterThan(0);
        expect(
            usages
                .filter(({ path, body }) =>
                    body === null ? !isGuarded(sourceOf(path)) : !WRAPPED_CHILD.test(body),
                )
                .map(({ path }) => path),
        ).toEqual([]);
    });

    test.each(CONTROLLED_MODALS)(
        '%s: opened only from a file that reads useRequiresOnline',
        name => {
            const unguarded = usagesOf(name).filter(
                ({ path, openTag }) =>
                    // The group settle-up's trigger lives in GroupSettleUpFlow (checked below).
                    !openTag.includes('source="group"') && !isGuarded(sourceOf(path)),
            );

            expect(unguarded.map(({ path }) => path)).toEqual([]);
        },
    );

    test.each(SELF_WRAPPED)('%s wraps its own action button', name => {
        expect(isGuarded(sourceOf(fileOf(name) ?? ''))).toBe(true);
    });

    const MODALS = [...TRIGGER_MODALS, ...CONTROLLED_MODALS, ...SELF_WRAPPED];

    // A file calling an online-only hook is covered when it is guarded itself, is one of the
    // checked modals, renders a self-wrapped confirmation, is a hook whose callers are covered, or a
    // component rendered only inside `<OnlineOnlyGroup action>` or by covered components. A
    // renderer's own guard does not cover what it renders (`asCaller` false): it may guard another
    // control of the same file.
    const isCovered = (path: string, seen: ReadonlySet<string>, asCaller = true): boolean => {
        const source = sourceOf(path);
        const name = nameOf(path);

        if (seen.has(path)) {
            return false;
        }
        const next = new Set([...seen, path]);

        if ((asCaller && isGuarded(source)) || EXEMPT.includes(name) || MODALS.includes(name)) {
            return true;
        }
        if (SELF_WRAPPED.some(wrapped => source.includes(`<${wrapped}`))) {
            return true;
        }
        if (path.includes('/hooks/')) {
            const exported = [...source.matchAll(/export const (use\w+)/g)].map(([, hook]) => hook);

            return exported.every(hook =>
                callersOf(hook ?? '').every(caller => isCovered(caller, next)),
            );
        }
        const renderers = usagesOf(name);

        return (
            renderers.length > 0 &&
            renderers.every(
                ({ path: renderer }) =>
                    new RegExp(`<OnlineOnlyGroup\\s+action=\\{[^}]*\\}>\\s*<${name}\\b`).test(
                        sourceOf(renderer),
                    ) || isCovered(renderer, next, false),
            )
        );
    };

    const callersOf = (hook: string): string[] =>
        Object.keys(sources).filter(
            path =>
                !DEFINITIONS.test(path) &&
                new RegExp(`\\b${hook}\\b`).test(sourceOf(path)) &&
                !new RegExp(`export const ${hook}\\b`).test(sourceOf(path)),
        );

    test.each(ONLINE_ONLY_HOOKS)('%s: every caller is behind a wrapper', hook => {
        const callers = callersOf(hook);

        expect(callers.length).toBeGreaterThan(0);
        expect(callers.filter(path => !isCovered(path, new Set()))).toEqual([]);
    });

    // KB NET-007 (#866): the expense writes are reasoned explicitly, not by `isCovered`. Their callers
    // render other controls too (the expense history wraps its settlement actions; the form's hooks
    // file serves the whole modal), so a guard anywhere in the file would cover them by accident.
    test('NET-007: create and edit run only through the form submit, wrapped in expenseSave', () => {
        const submitHooks = callersOf('useCreateExpense');

        expect(submitHooks.map(nameOf)).toEqual(['hooks']);
        expect(callersOf('useUpdateExpense')).toEqual(submitHooks);
        const submitters = callersOf('useExpenseModalSubmit');

        expect(submitters.map(nameOf)).toEqual(['ExpenseButtons']);
        submitters.forEach(path => {
            expect(sourceOf(path)).toMatch(
                /<OnlineOnly\s+action=\{ONLINE_ONLY_ACTIONS\.expenseSave\}/,
            );
        });
    });

    test('NET-007: the expense delete is wrapped in expenseDelete wherever it is called', () => {
        const callers = callersOf('useDeleteLedgerEntry');

        expect(callers.length).toBeGreaterThan(0);
        callers.forEach(path => {
            expect(sourceOf(path)).toMatch(
                /<OnlineOnly\s+action=\{ONLINE_ONLY_ACTIONS\.expenseDelete\}/,
            );
        });
    });
});
