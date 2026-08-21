import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Group } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';

import RemoveGroupAlertDialog from './RemoveGroupAlertDialog';

const OPEN_REMOVE_LABEL = 'Open removal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

beforeEach(() => {
    vi.clearAllMocks();
    useLoadingStore.getState().setInitialLoadingStore();
});

test('waits for confirmation before removing a group', () => {
    const removeGroup = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    const selectedGroup = {
        id: 'group-1',
        name: 'Trip',
        inviteToken: 'invite-token',
        description: null,
        creator: {
            id: 'user-1',
            email: 'user@example.com',
            displayName: 'User',
            firstName: null,
            lastName: null,
            picture: null,
            createdAt: 1,
            updatedAt: 1,
        },
        members: [],
        createdAt: 1,
        updatedAt: 1,
        coverUrl: null,
        simplifyDebts: true,
        role: 'OWNER',
        status: 'ACTIVE',
        lastUsedCurrency: null,
        recentActivities: { items: [], nextCursor: null },
    } satisfies Group;

    useGroupsStore.setState({ removeGroup, selectedGroup });

    render(
        <MemoryRouter>
            <RemoveGroupAlertDialog>
                <button type="button">{OPEN_REMOVE_LABEL}</button>
            </RemoveGroupAlertDialog>
        </MemoryRouter>,
    );

    return user
        .click(screen.getByRole('button', { name: OPEN_REMOVE_LABEL }))
        .then(() => {
            expect(screen.getByRole('alertdialog')).toBeTruthy();
            expect(removeGroup).not.toHaveBeenCalled();
            return user.click(screen.getByRole('button', { name: 'common:buttons.delete' }));
        })
        .then(() => waitFor(() => expect(removeGroup).toHaveBeenCalledWith({
            groupId: selectedGroup.id,
        })));
});
