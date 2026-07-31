import { expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { User } from 'api/chipin.types';
import { useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/users-store';

import ExpensePreferencesSection from './ExpensePreferencesSection';

import 'i18n/index';

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Alex',
    firstName: null,
    lastName: null,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: true,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies User;

test('keeps the selected default category visible but disabled when categories are skipped', () => {
    useUsersStore.setState({ user, localUser: null, friends: [] });
    useDashboardStore.setState(state => ({
        ...state,
        currencies: {
            base: 'USD',
            timestamp: 1,
            fetchedAt: 1,
            stale: false,
            rates: { USD: 1, EUR: 0.9 },
        },
    }));

    render(<ExpensePreferencesSection isLoading={false} />);

    const categoryButton = screen.getByRole('button', { name: /Food/i });

    expect(categoryButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('switch', { name: 'Skip category' }).getAttribute('aria-checked')).toBe(
        'true',
    );
    expect(screen.queryByText('Solo Mode by default')).toBeNull();
});
