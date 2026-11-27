import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import type { Group, SelfUser } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { currencyRatesKeys, EMPTY_CURRENCY_RATES } from 'entities/currency-rates';
import type { SelfUser as DomainSelfUser } from 'entities/users';
import { useAuthStore } from 'store/authStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';
import { seedGroupsList } from 'test/groupsList';
import { createKnownUser, seedKnownUsers } from 'test/knownUsers';
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';
import { seedSelfUser } from 'test/selfUserSeed';

import { AddExpenseModal } from './AddExpenseModal';

import 'i18n/index';

// KB EXP-067: the personal invite of the no-friend state (the Friends page flow).
const invite = vi.hoisted(() => ({
    isNativeShareSupported: false,
    onShare: vi.fn(() => Promise.resolve()),
    onCopyLink: vi.fn(() => Promise.resolve()),
}));

vi.mock('hooks/pwaHooks', async importOriginal => ({
    ...(await importOriginal<typeof import('hooks/pwaHooks')>()),
    useFriendInvite: () => ({
        inviteLink: 'https://chipin.one/friends/join/invite-token-user',
        isNativeShareSupported: invite.isNativeShareSupported,
        isShareDone: false,
        isCopied: false,
        qr: { title: '', accessibleDescription: '', description: '', subtitle: '' },
        onShare: invite.onShare,
        onCopyLink: invite.onCopyLink,
    }),
}));

// Rates already loaded: the currency picker does not request them.
const ratesClient = () => {
    const client = createTestQueryClient();

    client.setQueryData(currencyRatesKeys.all, EMPTY_CURRENCY_RATES);
    return client;
};

const creator = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const group = {
    id: 'group-1',
    name: 'Weekend Trip',
    inviteToken: 'invite-token',
    description: null,
    creator,
    members: [{ user: creator, balancesByCurrency: {} }],
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
} satisfies Group;

beforeEach(() => {
    vi.clearAllMocks();
    invite.isNativeShareSupported = false;
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP, lastGroupId: group.id });
    useExpenseModalStore.getState().reset();
    useAuthStore.setState({ status: 'authenticated' });
    seedGroupsList([group]);
    useExpenseModalStore.getState().open();
});

test('does not render a single-member notice in the modal', () => {
    renderWithQueryClient(
        <MemoryRouter initialEntries={['/group/group-1']}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseModal />
            </ThemeProvider>
        </MemoryRouter>,
        ratesClient(),
    );

    expect(screen.getByRole('status').textContent).toBe('');
    // #966 EXP-064: the always-visible blocker is polite; nothing is announced assertively on open.
    expect(screen.queryByRole('alert')).toBeNull();
    // #966 EXP-064: the one amount explanation is linked to the amount field, not the form.
    const [amountMessage] = screen.getAllByText('Enter an amount greater than zero.');
    expect(screen.getAllByText('Enter an amount greater than zero.')).toHaveLength(1);
    const amountInput = screen.getByRole('textbox', { name: 'Amount' });
    expect(amountInput.getAttribute('aria-invalid')).toBe('true');
    expect(amountInput.getAttribute('aria-describedby')).toBe(amountMessage?.id);
    expect(screen.queryByText(/invite.*members/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', true);
});

test('uses the edit title and Save action in edit mode', () => {
    useExpenseModalStore.setState({ mode: 'edit', isOpened: true });

    renderWithQueryClient(
        <MemoryRouter initialEntries={['/activity']}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseModal />
            </ThemeProvider>
        </MemoryRouter>,
        ratesClient(),
    );

    expect(screen.getByText('Edit expense')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
});

// Spec 03 §4.3 (03-14b): the form has no date field (removed in #327), so an edit never changes
// the date and the update patch has no `date`.
test('EXP-064 the edit form shows no date field: the date of an expense is read-only', () => {
    useExpenseModalStore.setState({ mode: 'edit', isOpened: true, date: 1_717_200_000 });

    renderWithQueryClient(
        <MemoryRouter initialEntries={['/activity']}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseModal />
            </ThemeProvider>
        </MemoryRouter>,
        ratesClient(),
    );

    const dialog = screen.getByRole('dialog');

    expect(screen.getByText('Edit expense')).not.toBeNull();
    expect(screen.queryByLabelText('Date')).toBeNull();
    expect(dialog.querySelector('input[type="datetime-local"], input[type="date"]')).toBeNull();
});

const member = { ...creator, id: 'user-2', email: 'bob@example.com', displayName: 'Bob' };

// #718: a group of two (an expense needs two participants) with a currency, and a newer group the
// list shows first.
const tripGroup = {
    ...group,
    members: [
        { user: creator, balancesByCurrency: {} },
        { user: member, balancesByCurrency: {} },
    ],
    lastUsedCurrency: 'USD',
} satisfies Group;
const newerGroup = { ...tripGroup, id: 'group-2', name: 'Flat', updatedAt: 2 } satisfies Group;

const renderAt = (path: string) =>
    renderWithQueryClient(
        <MemoryRouter initialEntries={[path]}>
            <ThemeProvider theme={lightThemeStyled}>
                <AddExpenseModal />
            </ThemeProvider>
        </MemoryRouter>,
        ratesClient(),
    );

/** The groups list resolves; the query notifies its observers on a later task. */
const receiveGroupsList = async (groups: Parameters<typeof seedGroupsList>[0]) => {
    await act(async () => {
        seedGroupsList(groups);
        await new Promise(resolve => {
            setTimeout(resolve, 0);
        });
    });
};

const enterAmount = (value: string) => {
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value } });
};

const submitButton = () => screen.getByRole('button', { name: 'Add expense' });

// #718: Add expense opened before `GET /groups` resolved.
test('EXP-063 a group page opened before the groups list loads uses that group once it arrives', async () => {
    seedGroupsList([]);
    renderAt('/group/group-1');

    expect(useExpenseModalStore.getState().groupId).toBe('');

    await receiveGroupsList([newerGroup, tripGroup]);
    enterAmount('10');

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('group');
    expect(state.groupId).toBe(tripGroup.id);
    expect(submitButton()).toHaveProperty('disabled', false);
});

test('EXP-063 a group page whose group is not in the loaded list picks no other group', async () => {
    useUiPrefsStore.setState({ lastGroupId: newerGroup.id });
    seedGroupsList([]);
    renderAt('/group/group-9');

    await receiveGroupsList([newerGroup, tripGroup]);

    expect(useExpenseModalStore.getState().groupId).toBe('');
});

test('EXP-063 a group picked on the dashboard after the groups list arrived has its members', async () => {
    const interaction = userEvent.setup();

    useUiPrefsStore.setState({ lastGroupId: null });
    seedKnownUsers([createKnownUser('user-5')]);
    seedGroupsList([]);
    renderAt('/');

    expect(useExpenseModalStore.getState().targetMode).toBe('friends');

    await receiveGroupsList([newerGroup, tripGroup]);
    await interaction.click(screen.getByRole('radio', { name: 'Group' }));
    await interaction.click(screen.getByRole('button', { name: /Group/ }));
    await interaction.click(screen.getByText(tripGroup.name));
    enterAmount('10');

    const state = useExpenseModalStore.getState();

    expect(state.groupId).toBe(tripGroup.id);
    expect(state.paidById).not.toBe('');
    expect(submitButton()).toHaveProperty('disabled', false);
});

test('EXP-063 a friend target the user chose before the groups list arrived is kept', async () => {
    const interaction = userEvent.setup();

    useUiPrefsStore.setState({ lastGroupId: null });
    seedKnownUsers([createKnownUser('user-5')]);
    seedGroupsList([]);
    renderAt('/');

    await interaction.click(screen.getByRole('radio', { name: 'Friends' }));
    await receiveGroupsList([newerGroup, tripGroup]);

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('friends');
    expect(state.groupId).toBe('');
});

test('EXP-063 an edit-expense modal is not reinitialized when the groups list arrives', async () => {
    seedGroupsList([]);
    useExpenseModalStore.setState({
        mode: 'edit',
        isOpened: true,
        targetMode: 'group',
        groupId: '',
        description: 'Dinner',
    });
    renderAt('/group/group-1');

    await receiveGroupsList([tripGroup]);

    const state = useExpenseModalStore.getState();

    expect(state.mode).toBe('edit');
    expect(state.groupId).toBe('');
    expect(state.description).toBe('Dinner');
});

// KB EXP-067: a dashboard direct expense before any mutual known user.
const selfUser = {
    ...creator,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
} satisfies SelfUser;

const noFriendTitle = 'No friends for a direct expense yet';
const groupFallbackName = 'Split in a group instead';

const openDirectWithoutFriend = async (groups: Parameters<typeof seedGroupsList>[0]) => {
    const interaction = userEvent.setup();

    useUiPrefsStore.setState({ lastGroupId: null });
    seedSelfUser(selfUser);
    seedKnownUsers([]);
    seedGroupsList(groups);
    const view = renderAt('/');

    await interaction.click(screen.getByRole('radio', { name: 'Friends' }));
    return { interaction, view };
};

test('EXP-067 no friend: the empty state replaces the payer, the split and the submit', async () => {
    await openDirectWithoutFriend([group]);

    expect(screen.getByText(noFriendTitle)).not.toBeNull();
    expect(
        screen.getByText(/once a person you invite accepts the invite and you are both friends/),
    ).not.toBeNull();
    expect(screen.queryByText('Paid by')).toBeNull();
    expect(screen.queryByText('How to split')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeNull();
    // EXP-064: the empty state is the one explanation.
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.queryByText('Enter an amount greater than zero.')).toBeNull();
    // A one-member group cannot take the expense: no group fallback.
    expect(screen.queryByRole('button', { name: groupFallbackName })).toBeNull();
});

test.each([
    [false, 'onCopyLink'],
    [true, 'onShare'],
] as const)(
    'EXP-067 the invite action (native share %s) uses %s and creates nothing',
    async (isNativeShareSupported, method) => {
        invite.isNativeShareSupported = isNativeShareSupported;
        const { interaction, view } = await openDirectWithoutFriend([]);

        await interaction.click(screen.getByRole('button', { name: 'Invite a friend' }));

        expect(invite[method]).toHaveBeenCalledTimes(1);
        expect(invite[method === 'onShare' ? 'onCopyLink' : 'onShare']).not.toHaveBeenCalled();
        expect(view.client.getMutationCache().getAll()).toHaveLength(0);

        const state = useExpenseModalStore.getState();

        expect(state.isOpened).toBe(true);
        expect(state.targetMode).toBe('friends');
        expect(state.source.knownFriends).toEqual([]);
    },
);

test('EXP-067 the group fallback switches the editor to an eligible group', async () => {
    // A one-member group and a group of two (`newerGroup`).
    const { interaction } = await openDirectWithoutFriend([group, newerGroup]);

    await interaction.click(screen.getByRole('button', { name: groupFallbackName }));

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('group');
    expect(state.groupId).toBe(newerGroup.id);
    expect(screen.queryByText(noFriendTitle)).toBeNull();
    expect(screen.getByText('How to split')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Add expense' })).not.toBeNull();
});

test('EXP-067 a known friend arriving while open makes the direct expense usable', async () => {
    await openDirectWithoutFriend([]);
    fireEvent.change(screen.getByPlaceholderText('e.g. Hotel booking, dinner...'), {
        target: { value: 'Dinner' },
    });
    enterAmount('10');

    await act(async () => {
        seedKnownUsers([createKnownUser('user-5')]);
        await new Promise(resolve => {
            setTimeout(resolve, 0);
        });
    });

    const state = useExpenseModalStore.getState();

    expect(screen.queryByText(noFriendTitle)).toBeNull();
    expect(state.targetMode).toBe('friends');
    expect(state.selectedFriendId).toBe('user-5');
    expect(state.paidById).toBe(selfUser.id);
    expect(state.description).toBe('Dinner');
    expect(state.amount).toBe('10');
    expect(submitButton()).toHaveProperty('disabled', false);
});

const selfWithCurrency = (
    lastSelectedCurrency: string | null,
    defaultCurrency = 'GBP',
): DomainSelfUser => ({
    id: creator.id,
    email: creator.email,
    displayName: creator.displayName,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite',
    settings: {
        defaultCurrency,
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    lastSelectedCurrency,
    createdAt: 1,
    updatedAt: 1,
});

test("EXP-072 a group expense starts with the viewer's own currency in the group, never the group's shared last used one", () => {
    seedSelfUser(selfWithCurrency(null));
    seedGroupsList([
        { ...tripGroup, lastUsedCurrency: 'KHR', lastSelectedCurrency: 'VND' },
        { ...newerGroup, lastUsedCurrency: 'KHR', lastSelectedCurrency: null },
    ]);
    renderAt('/group/group-1');

    expect(useExpenseModalStore.getState().currency).toBe('VND');

    // Another member's entry set the shared `lastUsedCurrency` of group-2: it is not the start.
    act(() => {
        useExpenseModalStore.getState().setGroupId(newerGroup.id);
    });
    // No preference of the viewer there: their default currency.
    expect(useExpenseModalStore.getState().currency).toBe('GBP');
});

test("EXP-072 a direct expense starts with the viewer's own currency with the friend, never the pair's shared last used one", () => {
    useUiPrefsStore.setState({ lastGroupId: null });
    seedGroupsList([]);
    seedKnownUsers([
        createKnownUser('user-5', [], { lastUsedCurrency: 'KHR', lastSelectedCurrency: 'THB' }),
        createKnownUser('user-6', [], { lastUsedCurrency: 'KHR', lastSelectedCurrency: null }),
    ]);
    renderAt('/');

    const state = useExpenseModalStore.getState();

    expect(state.targetMode).toBe('friends');
    expect(state.selectedFriendId).toBe('user-5');
    expect(state.currency).toBe('THB');
});

test('EXP-073 a currency the user picked is kept when the groups list refreshes with newer preferences', async () => {
    seedGroupsList([tripGroup]);
    renderAt('/group/group-1');

    act(() => {
        useExpenseModalStore.getState().setCurrency('JPY');
    });
    await receiveGroupsList([
        { ...newerGroup, lastSelectedCurrency: 'EUR' },
        { ...tripGroup, lastSelectedCurrency: 'VND' },
    ]);

    expect(useExpenseModalStore.getState().currency).toBe('JPY');
});

test('EXP-073 reopened after a VND create in a group whose list still has the old USD preference, the refreshed list brings VND', async () => {
    // The create reloaded the self user (overall VND); the groups list has not answered yet.
    seedSelfUser(selfWithCurrency('VND'));
    seedGroupsList([{ ...tripGroup, lastSelectedCurrency: 'USD' }]);
    renderAt('/group/group-1');

    expect(useExpenseModalStore.getState().currency).toBe('USD');

    // The list answers with the same groups and the new preference of the group.
    await receiveGroupsList([{ ...tripGroup, lastSelectedCurrency: 'VND' }]);

    const state = useExpenseModalStore.getState();

    expect(state.groupId).toBe(tripGroup.id);
    expect(state.currency).toBe('VND');
    expect(state.isCurrencyManuallyEdited).toBe(false);
});

test('EXP-073 a preference that arrives late for an unchanged target replaces only an untouched currency', async () => {
    seedSelfUser(selfWithCurrency(null));
    seedGroupsList([tripGroup]);
    renderAt('/group/group-1');

    expect(useExpenseModalStore.getState().currency).toBe('GBP');

    await act(async () => {
        seedSelfUser(selfWithCurrency('EUR'));
        await new Promise(resolve => {
            setTimeout(resolve, 0);
        });
    });
    expect(useExpenseModalStore.getState().currency).toBe('EUR');

    act(() => {
        useExpenseModalStore.getState().setCurrency('JPY');
    });
    await receiveGroupsList([{ ...tripGroup, lastSelectedCurrency: 'VND' }]);
    expect(useExpenseModalStore.getState().currency).toBe('JPY');
});
