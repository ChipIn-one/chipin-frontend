import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { FriendsList } from './FriendsList';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

const INVITE_LABEL = 'invite onboarding';

vi.mock('./FriendInviteEmptyState', () => ({
    FriendInviteEmptyState: () => <p>{INVITE_LABEL}</p>,
}));

const renderList = (props: Partial<Parameters<typeof FriendsList>[0]> = {}) =>
    render(
        <Theme>
            <FriendsList
                currencyGroups={[]}
                isEmpty={false}
                isError={false}
                isLoading={false}
                isOffline={false}
                onRetry={vi.fn()}
                settledFriends={[]}
                {...props}
            />
        </Theme>,
    );

test('USR-013 a failed first load shows the load error with Retry, and Retry calls onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    renderList({ isError: true, onRetry });

    expect(screen.getByText('loadErrorTitle')).toBeTruthy();
    expect(screen.getByText('loadErrorDescription')).toBeTruthy();
    expect(screen.queryByText('invite onboarding')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'retryAction' }));

    expect(onRetry).toHaveBeenCalledOnce();
});

test('USR-013 a first load waiting for the network shows the offline notice without Retry', () => {
    // `isError` is also set offline (`useKnownUsers` folds paused into it): offline wins.
    renderList({ isError: true, isOffline: true });

    expect(screen.getByText('network.offline')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'retryAction' })).toBeNull();
    expect(screen.queryByText('loadErrorTitle')).toBeNull();
});

test('USR-013 a loaded empty list shows the invite onboarding', () => {
    renderList({ isEmpty: true });

    expect(screen.getByText('invite onboarding')).toBeTruthy();
    expect(screen.queryByText('loadErrorTitle')).toBeNull();
});
