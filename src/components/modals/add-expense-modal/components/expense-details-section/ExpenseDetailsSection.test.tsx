import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';
import { useExpenseModalStore } from 'store/expenseModalStore';

import ExpenseDetailsSection from './ExpenseDetailsSection';

import 'i18n/index';

const currentUser = {
    id: 'user-1',
    displayName: 'Alex',
    picture: null,
};

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

const renderSection = () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <ExpenseDetailsSection />
        </ThemeProvider>,
    );
};

test('shows the category field when category selection is enabled', () => {
    useExpenseModalStore.getState().initialize({
        context: 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [],
    });

    renderSection();

    expect(screen.getAllByText('Category')).toHaveLength(1);
    expect(screen.queryByText('Paid by')).toBeNull();
});

test('replaces the category field with the payer field when category selection is skipped', () => {
    useExpenseModalStore.getState().initialize({
        context: 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: true,
        groups: [],
        knownFriends: [],
    });

    renderSection();

    expect(screen.queryAllByText('Category')).toHaveLength(0);
    expect(screen.getByText('Paid by')).not.toBeNull();
});

test('keeps category editing available in edit mode even when create skips category', () => {
    const store = useExpenseModalStore.getState();
    store.initialize({
        context: 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: true,
        groups: [],
        knownFriends: [],
    });
    useExpenseModalStore.setState({ mode: 'edit' });

    renderSection();

    expect(screen.getAllByText('Category').length).toBeGreaterThan(0);
    expect(screen.queryByText('Paid by')).toBeNull();
});
