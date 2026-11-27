// Issue #946: the "+N" overflow counter is translated and has a plural accessible name.
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import type { GroupUser } from 'api/chipin.types';
import { i18n } from 'i18n';

import { UsersRow } from './UsersRow';

const membersOf = (count: number): GroupUser[] =>
    Array.from({ length: count }, (_, index) => ({
        id: `user-${index}`,
        email: `user-${index}@example.com`,
        displayName: `User ${index}`,
        firstName: `User ${index}`,
        lastName: null,
        createdAt: 0,
        updatedAt: 0,
    }));

afterEach(() => i18n.changeLanguage('en'));

test('shows no counter when every member fits', () => {
    render(<UsersRow members={membersOf(3)} max={5} />);

    expect(screen.queryByRole('img', { name: /more/ })).toBeNull();
});

test('shows the "+N" counter named "N more members"', async () => {
    render(<UsersRow members={membersOf(7)} max={5} />);

    const counter = screen.getByRole('img', { name: '2 more members' });

    // Radix shows the fallback a tick after the (absent) image fails.
    await waitFor(() => expect(counter.textContent).toBe('+2'));
});

test('names a single hidden member in the singular', async () => {
    render(<UsersRow members={membersOf(6)} max={5} />);

    const counter = screen.getByRole('img', { name: '1 more member' });

    await waitFor(() => expect(counter.textContent).toBe('+1'));
});

test('uses the Russian plural forms', async () => {
    await act(() => i18n.changeLanguage('ru'));

    const { rerender } = render(<UsersRow members={membersOf(6)} max={5} />);

    expect(screen.getByRole('img', { name: 'Ещё 1 участник' })).toBeTruthy();

    rerender(<UsersRow members={membersOf(8)} max={5} />);
    expect(screen.getByRole('img', { name: 'Ещё 3 участника' })).toBeTruthy();

    rerender(<UsersRow members={membersOf(10)} max={5} />);
    expect(screen.getByRole('img', { name: 'Ещё 5 участников' })).toBeTruthy();
});
