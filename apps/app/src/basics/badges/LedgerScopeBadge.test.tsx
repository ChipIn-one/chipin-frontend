import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

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

test('shows between friends on a group page when the event has no group', () => {
    render(<LedgerScopeBadge groupId={null} groupName={null} currentGroupId="group-1" />);

    expect(screen.getByText('event.betweenFriends')).toBeTruthy();
});

test('hides the badge on the page of its own group', () => {
    const { container } = render(
        <LedgerScopeBadge groupId="group-1" groupName="Vietnam" currentGroupId="group-1" />,
    );

    expect(container.firstChild).toBeNull();
});

test('shows the group name on the page of another group', () => {
    render(<LedgerScopeBadge groupId="group-1" groupName="Vietnam" currentGroupId="group-2" />);

    expect(screen.getByText('Vietnam')).toBeTruthy();
});

test('shows the group name off group pages', () => {
    render(<LedgerScopeBadge groupId="group-1" groupName="Vietnam" />);

    expect(screen.getByText('Vietnam')).toBeTruthy();
});

test('shows between friends when the group name is no longer available', () => {
    render(<LedgerScopeBadge groupId="group-1" groupName={null} />);

    expect(screen.getByText('event.betweenFriends')).toBeTruthy();
});
