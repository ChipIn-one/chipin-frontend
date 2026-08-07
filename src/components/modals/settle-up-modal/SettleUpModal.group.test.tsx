import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { CreateSettlementParams, Group, User } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import SettleUpModal from './SettleUpModal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { name?: string }) =>
            options?.name ? `${key}:${options.name}` : key,
    }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

const currentUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
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
} satisfies User;

const groupUser = {
    id: currentUser.id,
    email: currentUser.email,
    displayName: currentUser.displayName,
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    picture: currentUser.picture,
    createdAt: currentUser.createdAt,
    updatedAt: currentUser.updatedAt,
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
            user: {
                ...groupUser,
                id: 'user-2',
                displayName: 'Owed Person Full',
                firstName: 'Owed',
            },
            balancesByCurrency: {
                EUR: { currency: 'EUR', netBalance: 25 },
            },
        },
        {
            user: {
                ...groupUser,
                id: 'user-3',
                displayName: 'Debtor Person Full',
                firstName: 'Debtor',
            },
            balancesByCurrency: {
                USD: { currency: 'USD', netBalance: -823_226.67 },
                EUR: { currency: 'EUR', netBalance: -30.1234 },
                BDT: { currency: 'BDT', netBalance: -90 },
                AFN: { currency: 'AFN', netBalance: -6 },
            },
        },
    ],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: 'https://cdn.example.com/group.webp',
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: {
        items: [],
        nextCursor: null,
    },
};

beforeEach(() => {
    vi.clearAllMocks();
    useGroupsStore.getState().setInitialGroupsStore();
    useUsersStore.setState({ user: currentUser });
    useLoadingStore.getState().setInitialLoadingStore();
});

test('disables the group settle-up trigger when every member is settled', () => {
    const settledGroup: Group = {
        ...group,
        members: group.members.map(member => ({ ...member, balancesByCurrency: {} })),
    };

    render(<SettleUpModal source="group" group={settledGroup} />);

    expect(screen.getByRole('button', { name: 'common:buttons.settleUp' })).toHaveProperty(
        'disabled',
        true,
    );
});

test('lists one row per group debt with display names and two-digit precision', () => {
    const user = userEvent.setup();

    render(<SettleUpModal source="group" group={group} />);

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.settleUp' }))
        .then(() => {
            const userDebtsHeading = screen.getByText('group:page.settleUp.youOwe');
            const userIsOwedHeading = screen.getByText('group:page.settleUp.owedToYou');

            expect(
                userDebtsHeading.compareDocumentPosition(userIsOwedHeading) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
            expect(
                screen.getAllByRole('button', { name: /Debtor Person Full/ }),
            ).toHaveLength(3);
            expect(screen.getByText('823.23K USD')).toBeTruthy();
            expect(screen.getByText('30.12 EUR')).toBeTruthy();
            expect(screen.queryByText('6 AFN')).toBeNull();
        });
});

test('uses summary formatting for the selected debt display', () => {
    const user = userEvent.setup();

    render(<SettleUpModal source="group" group={group} />);

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.settleUp' }))
        .then(() =>
            user.click(
                screen.getByRole('button', {
                    name: /Debtor Person Full.*823\.23K USD/,
                }),
            ),
        )
        .then(() => {
            expect(screen.getByText('823.23K USD')).toBeTruthy();
            expect(screen.getByRole('textbox')).toHaveProperty(
                'value',
                '823226.67',
            );
        });
});

test('toggles group debts beyond the first three rows within their section', () => {
    const user = userEvent.setup();

    render(<SettleUpModal source="group" group={group} />);

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.settleUp' }))
        .then(() =>
            user.click(
                screen.getByRole('button', { name: 'group:page.settleUp.showMore' }),
            ),
        )
        .then(() => {
            expect(screen.getByText('6 AFN')).toBeTruthy();
            expect(screen.getAllByRole('button', { name: /Debtor/ })).toHaveLength(4);
            return user.click(
                screen.getByRole('button', { name: 'group:page.settleUp.showLess' }),
            );
        })
        .then(() => {
            expect(screen.queryByText('6 AFN')).toBeNull();
            expect(screen.getAllByRole('button', { name: /Debtor/ })).toHaveLength(3);
        });
});

test('does not show an explanatory description above the group debt sections', () => {
    const user = userEvent.setup();

    render(<SettleUpModal source="group" group={group} />);

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.settleUp' }))
        .then(() => {
            expect(screen.queryByText('group:page.settleUp.chooseDebtDescription')).toBeNull();
        });
});

test('renders the group debt list inside a dedicated scroll area', () => {
    const user = userEvent.setup();

    render(<SettleUpModal source="group" group={group} />);

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.settleUp' }))
        .then(() => {
            expect(
                screen.getByRole('region', {
                    name: 'group:page.settleUp.chooseDebtTitle',
                }),
            ).toBeTruthy();
        });
});

test('keeps a hidden accessible description for the group debt selection dialog', () => {
    const user = userEvent.setup();

    render(<SettleUpModal source="group" group={group} />);

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.settleUp' }))
        .then(() => {
            const dialog = screen.getByRole('dialog');
            const descriptionId = dialog.getAttribute('aria-describedby');

            expect(descriptionId).not.toBeNull();
            expect(document.getElementById(descriptionId ?? '')?.textContent).toBe(
                'group:page.settleUp.chooseDebtAccessibleDescription',
            );
        });
});

test('uses the selected group debt currency as the initial payment currency', () => {
    const createSettlement = vi
        .fn<(params: Omit<CreateSettlementParams, 'groupId'>) => Promise<void>>()
        .mockResolvedValue();
    const user = userEvent.setup();
    useGroupsStore.setState({ createSettlement });

    render(<SettleUpModal source="group" group={group} />);

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.settleUp' }))
        .then(() =>
            user.click(
                screen.getByRole('button', {
                    name: /Debtor Person Full.*30.12 EUR/,
                }),
            ),
        )
        .then(() => {
            expect(screen.getByRole('textbox')).toHaveProperty('value', '30.1234');
            return user.click(
                screen.getByRole('button', { name: 'friends:settleUp.recordPayment' }),
            );
        })
        .then(() => {
            expect(createSettlement).toHaveBeenCalledWith({
                fromUserId: currentUser.id,
                toUserId: 'user-3',
                amount: 30.1234,
                currency: 'EUR',
            });
        });
});
