import { expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { User } from 'api/chipin.types';
import { useUsersStore } from 'store/users-store';

import SoloPreferencesSection from './SoloPreferencesSection';

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
        skipCategory: false,
        soloModeByDefault: true,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies User;

test('renders the two Solo preference switches in their own section', () => {
    useUsersStore.setState({ user, localUser: null, friends: [] });

    render(<SoloPreferencesSection isLoading={false} />);

    expect(screen.getByRole('switch', { name: 'Solo Mode by default' })).not.toBeNull();
    expect(screen.getByRole('switch', { name: 'Save group expenses to Solo' })).not.toBeNull();
});
