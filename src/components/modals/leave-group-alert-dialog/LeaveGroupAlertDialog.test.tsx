import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Group, User } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import LeaveGroupAlertDialog from './LeaveGroupAlertDialog';

const OPEN_LEAVE_LABEL = 'Open leave';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

const currentUser = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Current User',
    firstName: 'Current',
    lastName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '12h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies User;

const group = {
    id: 'group-1',
    name: 'Trip',
    inviteToken: 'invite',
    description: null,
    creator: currentUser,
    members: [{ user: currentUser, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    emoji: null,
    coverUrl: null,
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: {
        items: [],
        nextCursor: null,
    },
} satisfies Group;

beforeEach(() => {
    vi.clearAllMocks();
    useLoadingStore.getState().setInitialLoadingStore();
    useUsersStore.setState({ user: currentUser });
});

test('waits for confirmation before leaving a group', () => {
    const leaveGroup = vi.fn().mockResolvedValue(group.name);
    const user = userEvent.setup();

    useGroupsStore.setState({ leaveGroup, selectedGroup: group });

    render(
        <MemoryRouter>
            <LeaveGroupAlertDialog>
                <button type="button">{OPEN_LEAVE_LABEL}</button>
            </LeaveGroupAlertDialog>
        </MemoryRouter>,
    );

    return user
        .click(screen.getByRole('button', { name: OPEN_LEAVE_LABEL }))
        .then(() => {
            expect(leaveGroup).not.toHaveBeenCalled();
            return user.click(
                screen.getByRole('button', { name: 'common:buttons.leaveGroup' }),
            );
        })
        .then(() => waitFor(() => expect(leaveGroup).toHaveBeenCalledWith(undefined)));
});
