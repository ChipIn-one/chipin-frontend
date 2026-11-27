import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { currencyRatesKeys, EMPTY_CURRENCY_RATES } from 'entities/currency-rates';
import { i18n } from 'i18n';
import type { ExpenseModalSource } from 'store/expenseModalStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';

import ExpenseCurrencyCategoryFields from './ExpenseCurrencyCategoryFields';

const currentUser = { id: 'self', displayName: 'You', picture: null };
const friend = { id: 'friend', displayName: 'Alex', picture: null };

const NOTE = {
    group: 'Your last selected currency in this group',
    friend: 'Your last selected currency with this friend',
    global: 'Your last selected currency overall',
    default: 'Your default currency',
};

const ALL_NOTES = Object.values(NOTE);

const initialize = (overrides: Partial<ExpenseModalSource> = {}) => {
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser,
        defaultCurrency: null,
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group', members: [currentUser, friend] }],
        knownFriends: [],
        ...overrides,
    });
};

// Rates already loaded: the currency picker does not request them.
const renderFields = () => {
    const client = createTestQueryClient();

    client.setQueryData(currencyRatesKeys.all, EMPTY_CURRENCY_RATES);

    return renderWithQueryClient(<ExpenseCurrencyCategoryFields />, client);
};

const currencyTrigger = () =>
    screen.getByRole('button', { name: new RegExp(i18n.t('common:fields.currency')) });

const expectNoNote = () => {
    for (const note of ALL_NOTES) {
        expect(screen.queryByText(note)).toBeNull();
    }
    expect(currencyTrigger().getAttribute('aria-describedby')).toBeNull();
};

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

afterEach(async () => {
    await i18n.changeLanguage('en');
});

test('EXP-074 names the viewer last currency in this group as the source', () => {
    initialize({
        defaultCurrency: 'USD',
        lastSelectedCurrency: 'EUR',
        groups: [{ id: 'group', members: [currentUser, friend], lastSelectedCurrency: 'AMD' }],
    });
    renderFields();

    expect(useExpenseModalStore.getState().currency).toBe('AMD');
    expect(screen.getByText(NOTE.group)).toBeTruthy();
});

test('EXP-074 names the viewer last currency with the known user for a direct expense', () => {
    initialize({
        context: 'friends',
        defaultCurrency: 'USD',
        lastSelectedCurrency: 'EUR',
        groups: [],
        knownFriends: [{ ...friend, lastSelectedCurrency: 'GEL' }],
    });
    renderFields();

    expect(useExpenseModalStore.getState().currency).toBe('GEL');
    expect(screen.getByText(NOTE.friend)).toBeTruthy();
    expect(screen.queryByText(NOTE.group)).toBeNull();
});

test('EXP-074 names the viewer overall last currency when the target has none', () => {
    initialize({ defaultCurrency: 'USD', lastSelectedCurrency: 'EUR' });
    renderFields();

    expect(useExpenseModalStore.getState().currency).toBe('EUR');
    expect(screen.getByText(NOTE.global)).toBeTruthy();
});

test('EXP-074 names the viewer default currency when no last currency is known', () => {
    initialize({ defaultCurrency: 'USD' });
    renderFields();

    expect(useExpenseModalStore.getState().currency).toBe('USD');
    expect(screen.getByText(NOTE.default)).toBeTruthy();
});

test('EXP-074 links the note to the currency control with aria-describedby', () => {
    initialize({ defaultCurrency: 'USD' });
    renderFields();

    const note = screen.getByText(NOTE.default);

    expect(note.id).not.toBe('');
    expect(currencyTrigger().getAttribute('aria-describedby')).toBe(note.id);
});

test('EXP-074 shows no note for the app fallback currency', () => {
    initialize();
    renderFields();

    expectNoNote();
});

test('EXP-074 hides the note after a manual currency pick', () => {
    initialize({ defaultCurrency: 'USD' });
    useExpenseModalStore.getState().setCurrency('USD');
    renderFields();

    expectNoNote();
});

test('EXP-074 shows no note when editing an existing expense', () => {
    initialize({ defaultCurrency: 'USD' });
    useExpenseModalStore.setState({ mode: 'edit' });
    renderFields();

    expectNoNote();
});

test('EXP-074 shows no note when the stored currency is not the resolved one', () => {
    initialize({ defaultCurrency: 'USD' });
    // A restored draft can carry another currency without the manual flag.
    useExpenseModalStore.setState({ currency: 'JPY' });
    renderFields();

    expectNoNote();
});

test('EXP-074 renders the note in Russian without calling it a group currency', async () => {
    await i18n.changeLanguage('ru');
    initialize({
        defaultCurrency: 'USD',
        groups: [{ id: 'group', members: [currentUser, friend], lastSelectedCurrency: 'AMD' }],
    });
    renderFields();

    const note = screen.getByText('Последняя выбранная вами валюта в этой группе');

    expect(currencyTrigger().getAttribute('aria-describedby')).toBe(note.id);
    expect(note.textContent).not.toMatch(/валюта группы/i);
});

test('EXP-074 switches the group note to the friend note when the target becomes direct', () => {
    initialize({
        defaultCurrency: 'USD',
        groups: [{ id: 'group', members: [currentUser, friend], lastSelectedCurrency: 'AMD' }],
        knownFriends: [{ ...friend, lastSelectedCurrency: 'GEL' }],
    });
    renderFields();
    expect(screen.getByText(NOTE.group)).toBeTruthy();

    act(() => useExpenseModalStore.getState().setTargetMode('friends'));

    expect(useExpenseModalStore.getState().currency).toBe('GEL');
    expect(screen.queryByText(NOTE.group)).toBeNull();
    expect(currencyTrigger().getAttribute('aria-describedby')).toBe(
        screen.getByText(NOTE.friend).id,
    );
});

test('EXP-074 follows a reloaded group currency with both the note and the currency', () => {
    const source = { defaultCurrency: 'USD', lastSelectedCurrency: 'EUR' };

    initialize(source);
    renderFields();
    expect(screen.getByText(NOTE.global)).toBeTruthy();

    act(() =>
        useExpenseModalStore.getState().applyLateGroups({
            ...useExpenseModalStore.getState().source,
            ...source,
            groups: [{ id: 'group', members: [currentUser, friend], lastSelectedCurrency: 'AMD' }],
        }),
    );

    expect(useExpenseModalStore.getState().currency).toBe('AMD');
    expect(screen.queryByText(NOTE.global)).toBeNull();
    expect(screen.getByText(NOTE.group)).toBeTruthy();
});

test('EXP-074 keeps the note hidden after a manual pick when the data reloads', () => {
    initialize({ defaultCurrency: 'USD' });
    renderFields();
    expect(screen.getByText(NOTE.default)).toBeTruthy();

    act(() => useExpenseModalStore.getState().setCurrency('JPY'));
    expectNoNote();

    act(() =>
        useExpenseModalStore.getState().applyLateGroups({
            ...useExpenseModalStore.getState().source,
            groups: [{ id: 'group', members: [currentUser, friend], lastSelectedCurrency: 'AMD' }],
        }),
    );

    expect(useExpenseModalStore.getState().currency).toBe('JPY');
    expectNoNote();
});

test('EXP-074 shows no note for a direct target without a selected friend', () => {
    initialize({ context: 'friends', defaultCurrency: 'USD', groups: [], knownFriends: [] });
    renderFields();

    expect(useExpenseModalStore.getState().targetMode).toBe('friends');
    expect(useExpenseModalStore.getState().selectedFriendId).toBe('');
    expectNoNote();
});
