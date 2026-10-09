import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Group, SelfUser } from 'api/chipin.types';
import { useActivityStore } from 'store/activity-store';
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
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

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
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
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
        .then(() => {
            const showMoreButton = screen.getByRole('button', {
                name: 'group:page.settleUp.showMore',
            });

            expect(getComputedStyle(showMoreButton).width).toBe('100%');

            return user.click(showMoreButton);
        })
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

test('renders the group debt list as an accessible selection region', () => {
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

test('keeps a single constrained scroll body for group debt selection', () => {
    const user = userEvent.setup();

    render(<SettleUpModal source="group" group={group} />);

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.settleUp' }))
        .then(() => {
            const dialog = screen.getByRole('dialog');
            const scrollViewports = dialog.querySelectorAll(
                '[data-radix-scroll-area-viewport]',
            );
            const scrollRoot = scrollViewports[0]?.closest('.rt-ScrollAreaRoot');

            expect(scrollViewports).toHaveLength(1);
            expect(scrollRoot).not.toBeNull();
            expect(getComputedStyle(scrollRoot as HTMLElement).maxHeight).not.toBe('none');
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

test('closes the group debt selection dialog from its cancel footer action', () => {
    const user = userEvent.setup();

    render(<SettleUpModal source="group" group={group} />);

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.settleUp' }))
        .then(() => user.click(screen.getByRole('button', { name: 'common:buttons.cancel' })))
        .then(() => {
            expect(screen.queryByRole('dialog')).toBeNull();
        });
});

test('uses the selected group debt currency as the initial payment currency', () => {
    const createSettlement = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();

    useActivityStore.setState({ createSettlement });

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
                groupId: group.id,
            });
        });
});

test('keeps the same dialog node while navigating to payment and back', () => {
    const user = userEvent.setup();
    render(<SettleUpModal source="group" group={group} />);

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.settleUp' }))
        .then(() => {
            const dialog = screen.getByRole('dialog');

            return user.click(
                screen.getByRole('button', { name: /Debtor Person Full.*823/ }),
            ).then(() => {
                expect(screen.getByRole('dialog')).toBe(dialog);
                return user.click(screen.getByRole('button', { name: 'buttons.back' }));
            }).then(() => {
                expect(screen.getByRole('dialog')).toBe(dialog);
                expect(screen.getByText('group:page.settleUp.youOwe')).toBeTruthy();
                expect(screen.queryByRole('button', { name: 'buttons.back' })).toBeNull();
            });
        });
});

test('keeps the payment step when the selected debt disappears on balance refresh', () => {
    const user = userEvent.setup();
    const view = render(<SettleUpModal source="group" group={group} />);

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.settleUp' }))
        .then(() => user.click(
            screen.getByRole('button', { name: /Debtor Person Full.*823/ }),
        ))
        .then(() => {
            const dialog = screen.getByRole('dialog');
            const updatedGroup = {
                ...group,
                members: group.members.map(member => ({
                    ...member,
                    balancesByCurrency: {},
                })),
            };
            view.rerender(<SettleUpModal source="group" group={updatedGroup} />);

            expect(screen.getByRole('dialog')).toBe(dialog);
            expect(screen.getByRole('heading', { name: 'friends:settleUp.recordPayment' })).toBeTruthy();
            expect(screen.getByRole('textbox')).toBeTruthy();
        });
});
