import { screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import { currencyRatesKeys } from 'entities/currency-rates';
import { useAuthStore } from 'store/authStore';
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';
import { seedSelfUser } from 'test/selfUserSeed';

import ExpensePreferencesSection from './ExpensePreferencesSection';

import 'i18n/index';

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Alex',
    picture: null,
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
        skipCategory: true,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

test('keeps the selected default category visible but disabled when categories are skipped', () => {
    // Settings are a signed-in page: the self query's settings apply.
    useAuthStore.setState({ status: 'authenticated' });
    seedSelfUser(user);
    const client = createTestQueryClient();

    client.setQueryData(currencyRatesKeys.all, {
        base: 'USD',
        timestamp: 1,
        fetchedAt: 1,
        stale: false,
        rates: { USD: '1', EUR: '0.9' },
    });
    renderWithQueryClient(<ExpensePreferencesSection isLoading={false} />, client);

    const categoryButton = screen.getByRole('button', { name: /Food/i });

    expect(categoryButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('switch', { name: 'Skip category' }).getAttribute('aria-checked')).toBe(
        'true',
    );
    expect(screen.queryByText('Solo Mode by default')).toBeNull();
});
