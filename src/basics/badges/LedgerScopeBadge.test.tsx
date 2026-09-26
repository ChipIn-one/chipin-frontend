import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { LedgerScopeBadge } from './LedgerScopeBadge';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

test('shows between friends when the event has no group', () => {
    render(<LedgerScopeBadge groupId={null} groupName={null} />);

    expect(screen.getByText('event.betweenFriends')).toBeTruthy();
});

test('hides the badge when its page context already identifies the group', () => {
    const { container } = render(
        <MemoryRouter initialEntries={['/group/group-1']}>
            <Routes>
                <Route
                    path="/group/:groupId"
                    element={
                        <LedgerScopeBadge groupId="group-1" groupName="Vietnam" />
                    }
                />
            </Routes>
        </MemoryRouter>,
    );

    expect(container.firstChild).toBeNull();
});

test('shows group context when the group is no longer available', () => {
    render(<LedgerScopeBadge groupId="group-1" groupName="Vietnam" />);

    expect(screen.getByText('Vietnam')).toBeTruthy();
});
