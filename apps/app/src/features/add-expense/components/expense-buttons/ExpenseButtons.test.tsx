import { Theme } from '@radix-ui/themes';
import { MutationObserver, onlineManager, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import { capabilitiesQueryOptions, ledgerKeys, ledgerOnlineMutationKeys } from 'entities/ledger';
import { startUserLedgerOutbox } from 'hooks/useLedgerMutations';
import { i18n } from 'i18n';
import { currencyCode, fromUnits } from 'shared/money';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { resetOutbox } from 'test/outbox';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import { ExpenseButtons } from './ExpenseButtons';

import 'fake-indexeddb/auto';

const currentUser = { id: 'self', displayName: 'You', picture: null };
const friend = { id: 'friend', displayName: 'Friend', picture: null };
const secondFriend = { id: 'secondFriend', displayName: 'Second friend', picture: null };

beforeEach(() => {
    useExpenseModalStore.getState().reset();
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group', members: [currentUser, friend] }],
        knownFriends: [friend],
    });
});

afterEach(() => {
    vi.unstubAllEnvs();
    act(() => {
        onlineManager.setOnline(true);
    });
    useConnectivityStore.setState({ mode: 'online' });
    return i18n.changeLanguage('en');
});

test('EXP-064 leaves the blocking amount out of the form-level status (#966)', () => {
    render(<ExpenseButtons onClose={vi.fn()} />);

    const status = screen.getByRole('status');
    const button = screen.getByRole('button', { name: 'Add expense' });
    expect(status.textContent).toBe('');
    expect(screen.queryByText('Enter an amount greater than zero.')).toBeNull();
    expect(button.getAttribute('aria-describedby')).toBeNull();
    expect(button).toHaveProperty('disabled', true);
});

test('EXP-064 describes another first blocker with a polite atomic status', () => {
    act(() => {
        const store = useExpenseModalStore.getState();
        store.toggleAllParticipants();
        store.setAmount('10');
    });
    render(<ExpenseButtons onClose={vi.fn()} />);

    const status = screen.getByRole('status');
    const button = screen.getByRole('button', { name: 'Add expense' });
    expect(status.textContent).toBe(
        'Select eligible participants for this expense. For a direct expense, select a friend whose invitation has been accepted.',
    );
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
    expect(button.getAttribute('aria-describedby')).toBe(status.id);
    expect(button).toHaveProperty('disabled', true);
});

test('EXP-064 keeps the status mounted as participant feedback clears and returns', () => {
    render(<ExpenseButtons onClose={vi.fn()} />);
    const status = screen.getByRole('status');
    const button = screen.getByRole('button', { name: 'Add expense' });

    act(() => {
        const store = useExpenseModalStore.getState();
        store.toggleAllParticipants();
        store.setAmount('10');
    });
    expect(status.textContent).toBe(
        'Select eligible participants for this expense. For a direct expense, select a friend whose invitation has been accepted.',
    );
    expect(button).toHaveProperty('disabled', true);

    act(() => useExpenseModalStore.getState().toggleAllParticipants());
    expect(screen.getByRole('status')).toBe(status);
    expect(status.textContent).toBe('');
    expect(button.getAttribute('aria-describedby')).toBeNull();
    expect(button).toHaveProperty('disabled', false);

    act(() => useExpenseModalStore.getState().toggleAllParticipants());
    expect(screen.getByRole('status')).toBe(status);
    expect(button.getAttribute('aria-describedby')).toBe(status.id);
});

test.each([
    ['40', '40', 'Percentages total 80%. Add the remaining 20% to reach 100%.'],
    ['60', '60', 'Percentages total 120%. Remove the excess 20% to reach 100%.'],
])('EXP-064 shows exact percentage totals for %s + %s', (self, other, message) => {
    const store = useExpenseModalStore.getState();
    store.setAmount('10');
    store.setSplitMode(EXPENSE_SPLIT_MODES.PERCENT);
    store.setSplitValue(currentUser.id, self);
    store.setSplitValue(friend.id, other);
    render(<ExpenseButtons onClose={vi.fn()} />);

    expect(screen.getByRole('status').textContent).toBe(message);
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', true);

    act(() => store.setSplitValue(friend.id, String(100 - Number(self))));
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', false);
});

test.each([
    {
        shares: [30, 33.33, 33.34],
        message: 'Percentages total 96.67%. Add the remaining 3.33% to reach 100%.',
    },
    {
        shares: [40, 33.33, 33.34],
        message: 'Percentages total 106.67%. Remove the excess 6.67% to reach 100%.',
    },
])('EXP-064 rounds raw percentage float totals for display: $shares', ({ shares, message }) => {
    const current = shares.reduce((total, share) => total + share, 0);
    const difference = Math.abs(current - 100);
    const [selfShare = 0, friendShare = 0, secondFriendShare = 0] = shares;

    useExpenseModalStore.setState(state => ({
        source: {
            ...state.source,
            groups: [{ id: 'group', members: [currentUser, friend, secondFriend] }],
        },
        amount: '10',
        splitMode: EXPENSE_SPLIT_MODES.PERCENT,
        percentShares: {
            [currentUser.id]: String(selfShare),
            [friend.id]: String(friendShare),
            [secondFriend.id]: String(secondFriendShare),
        },
        includedParticipantIds: {
            [currentUser.id]: true,
            [friend.id]: true,
            [secondFriend.id]: true,
        },
    }));
    render(<ExpenseButtons onClose={vi.fn()} />);

    const statusText = screen.getByRole('status').textContent ?? '';
    expect(statusText).toBe(message);
    expect(statusText).not.toContain(String(difference));
    expect(statusText).not.toMatch(/\d\.\d{3,}/);
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', true);
});

test('EXP-064 keeps a sub-step percent difference visible instead of masking it as zero', () => {
    useExpenseModalStore.setState(state => ({
        source: {
            ...state.source,
            groups: [{ id: 'group', members: [currentUser, friend, secondFriend] }],
        },
        amount: '10',
        splitMode: EXPENSE_SPLIT_MODES.PERCENT,
        percentShares: {
            [currentUser.id]: '33.3333',
            [friend.id]: '33.3333',
            [secondFriend.id]: '33.3333',
        },
        includedParticipantIds: {
            [currentUser.id]: true,
            [friend.id]: true,
            [secondFriend.id]: true,
        },
    }));
    render(<ExpenseButtons onClose={vi.fn()} />);

    const statusText = screen.getByRole('status').textContent ?? '';
    expect(statusText).toBe('Percentages total 99.9999%. Add the remaining < 0.01% to reach 100%.');
    expect(statusText).not.toContain('0.0001');
    expect(statusText).not.toContain('total 0%');
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', true);
});

test('EXP-064 explains a percent total that rounds below the display precision', () => {
    useExpenseModalStore.setState(state => ({
        source: {
            ...state.source,
            groups: [{ id: 'group', members: [currentUser, friend, secondFriend] }],
        },
        amount: '10',
        splitMode: EXPENSE_SPLIT_MODES.PERCENT,
        percentShares: {
            [currentUser.id]: '33.33333',
            [friend.id]: '33.33333',
            [secondFriend.id]: '33.33333',
        },
        includedParticipantIds: {
            [currentUser.id]: true,
            [friend.id]: true,
            [secondFriend.id]: true,
        },
    }));
    render(<ExpenseButtons onClose={vi.fn()} />);

    const statusText = screen.getByRole('status').textContent ?? '';
    expect(statusText).toBe('Percentages total < 100%. Add the remaining < 0.01% to reach 100%.');
    expect(statusText).not.toContain('total 100%');
    expect(statusText).not.toContain('0.00001');
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', true);
});

test.each([
    [
        '9.998',
        'Allocated 9.998 USD of 10 USD. Add the remaining 0.002 USD so the amounts equal the expense total.',
    ],
    [
        '10.002',
        'Allocated 10.002 USD of 10 USD. Remove the excess 0.002 USD so the amounts equal the expense total.',
    ],
])('EXP-064 preserves the visible exact amount mismatch for %s', (allocated, message) => {
    useExpenseModalStore.setState({
        amount: '10',
        splitMode: EXPENSE_SPLIT_MODES.AMOUNTS,
        amountShares: { self: allocated, friend: '0' },
    });
    render(<ExpenseButtons onClose={vi.fn()} />);

    expect(screen.getByRole('status').textContent).toBe(message);
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', true);

    act(() => useExpenseModalStore.setState({ amountShares: { self: '5', friend: '5' } }));
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', false);
});

test('EXP-064 explains a non-positive total share weight', () => {
    useExpenseModalStore.setState({
        amount: '10',
        splitMode: EXPENSE_SPLIT_MODES.SHARES,
        shareWeights: { self: '0', friend: '0' },
    });
    render(<ExpenseButtons onClose={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe(
        'Give at least one participant a positive share. The total share weight must be greater than zero.',
    );

    act(() => useExpenseModalStore.getState().setSplitValue(friend.id, '1'));
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', false);
});

test('EXP-064 distinguishes an unchanged Save from invalid input and submission in progress', async () => {
    useExpenseModalStore.setState({
        amount: '10',
        mode: 'edit',
        editContext: {
            entryId: 'entry',
            original: {
                description: null,
                amount: fromUnits(100_000n, currencyCode('USD')),
                payerId: currentUser.id,
                participantIds: [currentUser.id, friend.id],
                currency: 'USD',
                category: 'food',
                subcategory: null,
                sharingMode: { type: 'AUTO' },
            },
        },
    });
    render(<ExpenseButtons onClose={vi.fn()} />);
    const status = screen.getByRole('status');
    const button = screen.getByRole('button', { name: 'Save' });
    expect(status.textContent).toBe('Make a change to save this expense.');
    expect(button).toHaveProperty('disabled', true);

    act(() => useExpenseModalStore.getState().setDescription('Lunch'));
    expect(status.textContent).toBe('');
    expect(button).toHaveProperty('disabled', false);

    // A submission in progress is a running update mutation on the client (spec 03 §6 row 6).
    let finishUpdate = (): void => undefined;
    let update: Promise<void> = Promise.resolve();

    act(() => {
        update = new MutationObserver(getDefaultTestQueryClient(), {
            mutationKey: ledgerOnlineMutationKeys.updateEntry,
            mutationFn: () =>
                new Promise<void>(resolve => {
                    finishUpdate = resolve;
                }),
        }).mutate();
    });
    await waitFor(() => {
        expect(button).toHaveProperty('disabled', true);
    });
    expect(status.textContent).toBe('');
    expect(button.getAttribute('aria-describedby')).toBeNull();
    expect(button).toHaveProperty('disabled', true);

    act(() => useExpenseModalStore.getState().toggleAllParticipants());
    expect(status.textContent).toBe('');
    await act(async () => {
        finishUpdate();
        await update;
    });
    await waitFor(() => {
        expect(status.textContent).toBe(
            'Select eligible participants for this expense. For a direct expense, select a friend whose invitation has been accepted.',
        );
    });
    expect(button.getAttribute('aria-describedby')).toBe(status.id);
});

test.each(['en', 'ru'])('EXP-064 localizes all blocker messages in %s', language => {
    const reasons = [
        'amount',
        'target',
        'participants',
        'payer',
        'percentUnder',
        'percentOver',
        'amountsUnder',
        'amountsOver',
        'shares',
        'noDebt',
        'unchanged',
    ];
    return i18n.changeLanguage(language).then(() => {
        for (const reason of reasons) {
            expect(
                i18n.exists(`group:expenses.modal.submitFeedback.${reason}`, {
                    lng: language,
                    fallbackLng: false,
                }),
            ).toBe(true);
        }
        act(() => {
            const store = useExpenseModalStore.getState();
            store.toggleAllParticipants();
            store.setAmount('10');
        });
        render(<ExpenseButtons onClose={vi.fn()} />);
        const status = screen.getByRole('status');
        expect(status.textContent).not.toBe('');
        expect(status.textContent).not.toContain('submitFeedback');
        if (language !== 'en') {
            expect(status.textContent).not.toBe(
                'Select eligible participants for this expense. For a direct expense, select a friend whose invitation has been accepted.',
            );
        }
    });
});

test('keeps cancellation available while input is invalid', () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseButtons onClose={onClose} />);
    return user.click(screen.getByRole('button', { name: 'Cancel' })).then(() => {
        expect(onClose).toHaveBeenCalledOnce();
    });
});

test('EXP-064 names a split value the backend cannot read', async () => {
    useExpenseModalStore.setState({
        amount: '10',
        splitMode: EXPENSE_SPLIT_MODES.AMOUNTS,
        amountShares: { [currentUser.id]: '1e3', [friend.id]: '0' },
    });
    render(<ExpenseButtons onClose={vi.fn()} />);

    expect(screen.getByRole('status').textContent).toBe(
        'A split value is not a valid number. Correct it to continue.',
    );
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveProperty('disabled', true);

    await act(() => i18n.changeLanguage('ru'));
    const russian = i18n.t('group:expenses.modal.submitFeedback.invalidValue');
    expect(russian).not.toBe('A split value is not a valid number. Correct it to continue.');
    expect(screen.getByRole('status').textContent).toBe(russian);
});

describe('KB NET-007: the expense save offline', () => {
    const goOffline = (): void => {
        act(() => {
            onlineManager.setOnline(false);
        });
    };
    const saveButton = (name = 'Add expense') => screen.getByRole('button', { name });
    const editOriginal = {
        description: null,
        amount: fromUnits(100_000n, currencyCode('USD')),
        payerId: currentUser.id,
        participantIds: [currentUser.id, friend.id],
        currency: 'USD',
        category: 'food',
        subcategory: null,
        sharingMode: { type: 'AUTO' as const },
    };
    // An edit with a change to save (amount 10 → description added).
    const editMode = (): void => {
        useExpenseModalStore.setState({
            amount: '10',
            mode: 'edit',
            editContext: { entryId: 'entry', original: editOriginal },
        });
        useExpenseModalStore.getState().setDescription('Lunch');
    };
    // Offline writes available: the flag, the outbox of the user restored, the capabilities.
    const withOutbox = async (): Promise<QueryClient> => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        const client = mountAsUserClient(currentUser.id);

        await clear();
        await startUserLedgerOutbox(client, currentUser.id);
        client.setQueryData(capabilitiesQueryOptions().queryKey, [
            'ledger.clientEntryId',
            'ledger.entryVersion',
            'client.minVersion',
        ]);
        return client;
    };

    beforeEach(() => {
        useExpenseModalStore.getState().setAmount('10');
    });

    afterEach(() => {
        resetOutbox();
        useAuthStore.setState({ sessionMode: 'online' });
    });

    test('NET-007: flag off, offline: the save is disabled with the hint and submits nothing; online: enabled', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();

        goOffline();
        const { container } = render(<ExpenseButtons onClose={onClose} />, { wrapper: Theme });

        expect(saveButton()).toHaveProperty('disabled', true);
        expect(saveButton().getAttribute('aria-disabled')).toBe('true');
        expect(container.querySelector('[data-online-only="expense.save"]')).not.toBeNull();
        await user.hover(saveButton().parentElement ?? saveButton());
        expect((await screen.findByRole('tooltip')).textContent).toContain(
            'An internet connection is required',
        );
        await user.click(saveButton().parentElement ?? saveButton());
        expect(onClose).not.toHaveBeenCalled();
        expect(getDefaultTestQueryClient().isMutating()).toBe(0);

        act(() => {
            onlineManager.setOnline(true);
        });
        expect(saveButton()).toHaveProperty('disabled', false);
        expect(container.querySelector('[data-online-only]')).toBeNull();
    });

    test('NET-007: flag off, offline, edit mode: the Save is disabled; online: enabled', () => {
        editMode();
        goOffline();
        const { container } = render(<ExpenseButtons onClose={vi.fn()} />, { wrapper: Theme });

        expect(saveButton('Save')).toHaveProperty('disabled', true);
        expect(container.querySelector('[data-online-only="expense.save"]')).not.toBeNull();
        act(() => {
            onlineManager.setOnline(true);
        });
        expect(saveButton('Save')).toHaveProperty('disabled', false);
    });

    test('NET-007: flag off, an offline-cached session: the save is disabled even with the network', () => {
        useAuthStore.setState({ sessionMode: 'offline-cached' });
        render(<ExpenseButtons onClose={vi.fn()} />, { wrapper: Theme });

        expect(saveButton()).toHaveProperty('disabled', true);
    });

    test('NET-007: flag on, offline, the outbox can take it: the save is not blocked', async () => {
        await withOutbox();
        goOffline();
        const { container } = render(<ExpenseButtons onClose={vi.fn()} />, { wrapper: Theme });

        await waitFor(() => {
            expect(saveButton()).toHaveProperty('disabled', false);
        });
        expect(container.querySelector('[data-online-only]')).toBeNull();
    });

    test('NET-007: flag on, offline, outbox unavailable (no capabilities): the save is disabled with the hint', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        goOffline();
        const { container } = render(<ExpenseButtons onClose={vi.fn()} />, { wrapper: Theme });

        await act(() => new Promise(resolve => setTimeout(resolve, 20)));
        expect(saveButton()).toHaveProperty('disabled', true);
        expect(container.querySelector('[data-online-only="expense.save"]')).not.toBeNull();
    });

    test('NET-007: flag on, offline, an edit of an entry not cached as an expense: the Save is disabled; cached: enabled', async () => {
        const client = await withOutbox();

        editMode();
        goOffline();
        render(<ExpenseButtons onClose={vi.fn()} />, { wrapper: Theme });

        await act(() => new Promise(resolve => setTimeout(resolve, 20)));
        expect(saveButton('Save')).toHaveProperty('disabled', true);
        act(() => {
            client.setQueryData(ledgerKeys.entry('entry'), {
                id: 'entry',
                type: 'EXPENSE',
                version: '1',
            });
        });
        await waitFor(() => {
            expect(saveButton('Save')).toHaveProperty('disabled', false);
        });
    });

    test('NET-002: flag off, backend down with a usable network: nothing is blocked', () => {
        act(() => {
            onlineManager.setOnline(true);
        });
        useAuthStore.setState({ sessionMode: 'online' });
        useConnectivityStore.setState({ mode: 'backend-down' });
        const { container } = render(<ExpenseButtons onClose={vi.fn()} />, { wrapper: Theme });

        expect(container.querySelector('[data-online-only]')).toBeNull();
        expect(saveButton()).toHaveProperty('disabled', false);
    });
});
