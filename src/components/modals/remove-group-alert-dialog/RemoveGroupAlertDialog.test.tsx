import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Group } from 'api/chipin.types';
import { useActivityStore } from 'store/activity-store';
import { useAuthStore } from 'store/authStore';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import RemoveGroupAlertDialog from './RemoveGroupAlertDialog';

const OPEN_REMOVE_LABEL = 'Open removal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const server = setupMswServer();

beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    mountAsUserClient();
    useActivityStore.setState({ fetchSetActivity: vi.fn(() => Promise.resolve()) });
    server.use(http.get('*/groups', () => HttpResponse.json({ items: [], nextCursor: null })));
});

afterEach(() => {
    useAuthStore.setState({ status: 'unknown' });
});

test('waits for confirmation before removing a group', () => {
    const removeGroup = vi.fn();
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

    server.use(
        http.delete('*/groups/:groupId', ({ params }) => {
            removeGroup({ groupId: params.groupId });
            return new HttpResponse(null, { status: 204 });
        }),
    );

    render(
        <MemoryRouter>
            <RemoveGroupAlertDialog group={selectedGroup}>
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
        .then(() =>
            waitFor(() =>
                expect(removeGroup).toHaveBeenCalledWith({
                    groupId: selectedGroup.id,
                }),
            ),
        );
});
