// 03-16a part C: settle-up with unsent expenses is refused with a hint (spec 03 §2.4 (11)), and the
// group flow is closed entirely while settle-up needs the network (§2.9).
import { Theme } from '@radix-ui/themes';
import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import type { Group } from 'entities/groups';
import type { OutboxOverlay, PendingOutboxItem } from 'entities/ledger';
import { currencyCode, fromUnits } from 'shared/money';
import { useOutboxSheetStore } from 'store/outboxSheetStore';
import { groupBalances } from 'test/groupFixtures';
import { seedSelfUser } from 'test/selfUserSeed';

import SettleUpModal from './SettleUpModal';

import 'i18n/index';

const ledger = vi.hoisted(() => ({
    patch: null as Partial<OutboxOverlay> | null,
}));

// The real overlay (flag off: the empty view) unless a test queues something.
vi.mock('entities/ledger', async importOriginal => {
    const actual = await importOriginal<typeof import('entities/ledger')>();

    return {
        ...actual,
        useOutboxOverlay: (): OutboxOverlay => {
            const real = actual.useOutboxOverlay();

            return ledger.patch === null ? real : { ...real, ...ledger.patch };
        },
    };
});

vi.mock('hooks/useLedgerMutations', async importOriginal => ({
    ...(await importOriginal<typeof import('hooks/useLedgerMutations')>()),
    useCreateSettlement: () => ({ createSettlement: vi.fn(), isPending: false }),
}));

const GROUP_HINT = 'Send or cancel the unsent expenses of this group first';
const FRIENDS_HINT = 'Send or cancel the unsent expenses first';

const currentUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '12h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

const groupUser = {
    id: currentUser.id,
    email: currentUser.email,
    displayName: currentUser.displayName,
    picture: currentUser.picture,
    createdAt: 1,
    updatedAt: 1,
};

const group: Group = {
    id: 'group-1',
    name: 'Weekend Trip',
    inviteToken: 'invite-token',
    description: null,
    creator: groupUser,
    members: [
        { user: groupUser, balancesByCurrency: {} },
        {
            user: { ...groupUser, id: 'user-3', displayName: 'Debtor Person' },
            balancesByCurrency: groupBalances({ USD: -30 }),
        },
    ],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: { items: [], nextCursor: null },
};

const friend = {
    id: 'user-2',
    email: 'bob@example.com',
    displayName: 'Bob Builder',
    firstName: 'Bob',
    lastName: 'Builder',
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const pendingItem = (opId: string): PendingOutboxItem => ({
    opId,
    entryId: `entry-${opId}`,
    kind: 'createExpense',
    description: null,
    amount: null,
    share: null,
    relatedOpIds: [],
    canCancel: true,
    status: 'queued',
});

// `count` readable pending ops of `groupIds` (the restore done).
const queue = (count: number, groupIds: string[] = []): void => {
    ledger.patch = {
        restore: 'ok',
        count,
        pending: Array.from({ length: count }, (_, index) => pendingItem(`op-${index}`)),
        queuedGroupIds: new Set(groupIds),
    };
};

const CHECKING = 'Checking the unsent operations of this device…';

const openGroupSettleUp = async (): Promise<void> => {
    render(<SettleUpModal source="group" group={group} />, { wrapper: Theme });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Settle up' }));
};

const renderFriendSettleUp = (onOpenChange = vi.fn()) =>
    render(
        <SettleUpModal
            source="friend"
            isOpened
            onOpenChange={onOpenChange}
            friend={friend}
            balances={[{ net: fromUnits(-100_000n, currencyCode('USD')) }]}
            initialCurrency="USD"
            onSubmit={vi.fn()}
        />,
        { wrapper: Theme },
    );

beforeEach(() => {
    seedSelfUser(currentUser);
});

afterEach(() => {
    ledger.patch = null;
    vi.unstubAllEnvs();
    act(() => {
        onlineManager.setOnline(true);
    });
    useOutboxSheetStore.setState({ isOpen: false });
});

describe('a group settle-up with unsent expenses of the group', () => {
    test('flag off (the real, empty overlay): never refused, the debts are listed', async () => {
        await openGroupSettleUp();

        expect(screen.queryByText(GROUP_HINT)).toBeNull();
        expect(screen.getByRole('button', { name: /Debtor Person/ })).toBeTruthy();
    });

    test('refused with the hint; its button closes the flow and opens OutboxSheet', async () => {
        queue(2, ['group-1']);
        await openGroupSettleUp();

        expect(screen.getByText(GROUP_HINT)).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Debtor Person/ })).toBeNull();
        await userEvent
            .setup()
            .click(screen.getByRole('button', { name: 'Show unsent operations' }));
        expect(useOutboxSheetStore.getState().isOpen).toBe(true);
        expect(screen.queryByText(GROUP_HINT)).toBeNull();
    });

    test('unsent expenses of another group (or personal ones) do not refuse it', async () => {
        queue(3, ['group-2']);
        await openGroupSettleUp();

        expect(screen.queryByText(GROUP_HINT)).toBeNull();
        expect(screen.getByRole('button', { name: /Debtor Person/ })).toBeTruthy();
    });
});

describe('03-16b a conflict draft is unsent intent: it refuses settle-up like a queued expense', () => {
    const draft = {
        entryId: 'entry-d',
        groupId: 'group-1',
        parentActivityId: null,
        description: null,
        createdAt: 1,
    };

    test('a draft of the group refuses the group settle-up', async () => {
        ledger.patch = {
            restore: 'ok',
            count: 1,
            conflictDrafts: [draft],
            queuedGroupIds: new Set(['group-1']),
        };
        await openGroupSettleUp();

        expect(screen.getByText(GROUP_HINT)).toBeTruthy();
    });

    test('any draft refuses the friends settle-up', () => {
        ledger.patch = { restore: 'ok', count: 1, conflictDrafts: [draft] };
        renderFriendSettleUp();

        expect(screen.getByText(FRIENDS_HINT)).toBeTruthy();
    });
});

describe('M2, L5: what does not refuse, and the restore still running', () => {
    test('unreadable records (they have no action) refuse neither the group nor the friends', async () => {
        ledger.patch = { restore: 'ok', count: 2, unreadableCount: 2 };
        await openGroupSettleUp();

        expect(screen.queryByText(GROUP_HINT)).toBeNull();
        expect(screen.getByRole('button', { name: /Debtor Person/ })).toBeTruthy();
    });

    test('unreadable records do not refuse the friends form', () => {
        ledger.patch = { restore: 'ok', count: 1, unreadableCount: 1 };
        renderFriendSettleUp();

        expect(screen.queryByText(FRIENDS_HINT)).toBeNull();
        expect(screen.getByRole('textbox')).toBeTruthy();
    });

    test('the stored outbox not read yet: refused with "checking", no list button', async () => {
        ledger.patch = { restore: 'pending' };
        await openGroupSettleUp();

        expect(screen.getByText(CHECKING)).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Show unsent operations' })).toBeNull();
    });

    test('a failed read of the outbox does not refuse (its banner and caption stay)', () => {
        ledger.patch = { restore: 'failed' };
        renderFriendSettleUp();

        expect(screen.queryByText(CHECKING)).toBeNull();
        expect(screen.getByRole('textbox')).toBeTruthy();
    });
});

describe('the friends settle-up (its balances span groups): refused while anything is queued', () => {
    test('nothing queued: the payment form', () => {
        renderFriendSettleUp();

        expect(screen.queryByText(FRIENDS_HINT)).toBeNull();
        expect(screen.getByRole('textbox')).toBeTruthy();
    });

    test('an op of any group queued: the hint, and the way to OutboxSheet', async () => {
        const onOpenChange = vi.fn();

        queue(1, ['group-9']);
        renderFriendSettleUp(onOpenChange);

        expect(screen.getByText(FRIENDS_HINT)).toBeTruthy();
        expect(screen.queryByRole('textbox')).toBeNull();
        await userEvent
            .setup()
            .click(screen.getByRole('button', { name: 'Show unsent operations' }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(useOutboxSheetStore.getState().isOpen).toBe(true);
    });
});

describe('§2.9: the group flow is online-only', () => {
    test('flag off, offline: the trigger opens the flow as before', async () => {
        act(() => {
            onlineManager.setOnline(false);
        });
        await openGroupSettleUp();

        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    test('flag on, offline: the trigger is disabled and the flow does not open', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        act(() => {
            onlineManager.setOnline(false);
        });
        render(<SettleUpModal source="group" group={group} />, { wrapper: Theme });
        const trigger = screen.getByRole('button', { name: 'Settle up' });

        expect(trigger).toHaveProperty('disabled', true);
        expect(trigger.getAttribute('aria-disabled')).toBe('true');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    test('flag on: an open flow is closed when the network goes, and stays closed after', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        await openGroupSettleUp();
        expect(screen.getByRole('dialog')).toBeTruthy();

        act(() => {
            onlineManager.setOnline(false);
        });
        expect(screen.queryByRole('dialog')).toBeNull();
        act(() => {
            onlineManager.setOnline(true);
        });
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
