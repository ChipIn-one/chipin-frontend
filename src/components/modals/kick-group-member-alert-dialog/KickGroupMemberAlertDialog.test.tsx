import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { GroupUser } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';

import KickGroupMemberAlertDialog from './KickGroupMemberAlertDialog';

const OPEN_KICK_LABEL = 'Open kick';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { name?: string }) =>
            options?.name ? `${key}:${options.name}` : key,
    }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

const member = {
    id: 'member-1',
    email: 'member@example.com',
    displayName: 'Member One',
    firstName: 'Member',
    lastName: 'One',
    picture: null,
    createdAt: 1,
    updatedAt: 1,
} satisfies GroupUser;

beforeEach(() => {
    vi.clearAllMocks();
    useLoadingStore.getState().setInitialLoadingStore();
});

test('waits for confirmation before kicking a group member', () => {
    const kickGroupMember = vi.fn().mockResolvedValue(member.displayName);
    const user = userEvent.setup();

    useGroupsStore.setState({ kickGroupMember });

    render(
        <KickGroupMemberAlertDialog member={member}>
            <button type="button">{OPEN_KICK_LABEL}</button>
        </KickGroupMemberAlertDialog>,
    );

    return user
        .click(screen.getByRole('button', { name: OPEN_KICK_LABEL }))
        .then(() => {
            expect(kickGroupMember).not.toHaveBeenCalled();
            return user.click(
                screen.getByRole('button', { name: 'common:buttons.kickMember' }),
            );
        })
        .then(() => {
            return waitFor(() => {
                expect(kickGroupMember).toHaveBeenCalledWith({ userId: member.id });
            });
        });
});
