import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Group, SelfUser } from 'api/chipin.types';
import { useActivityStore } from 'store/activity-store';
import { useAuthStore } from 'store/authStore';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import LeaveGroupAlertDialog from './LeaveGroupAlertDialog';

const OPEN_LEAVE_LABEL = 'Open leave';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const currentUser = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Current User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
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
} satisfies SelfUser;

const group = {
    id: 'group-1',
    name: 'Trip',
    inviteToken: 'invite',
    description: null,
    creator: currentUser,
    members: [{ user: currentUser, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: 'https://cdn.example.com/group.webp',
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: {
        items: [],
        nextCursor: null,
    },
} satisfies Group;

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

test('waits for confirmation before leaving a group', () => {
    const leaveGroup = vi.fn();
    const user = userEvent.setup();

    server.use(
        http.post('*/groups/:groupId/leave', ({ params }) => {
            leaveGroup({ groupId: params.groupId });
            return new HttpResponse(null, { status: 204 });
        }),
    );

    render(
        <MemoryRouter>
            <LeaveGroupAlertDialog group={group}>
                <button type="button">{OPEN_LEAVE_LABEL}</button>
            </LeaveGroupAlertDialog>
        </MemoryRouter>,
    );

    return user
        .click(screen.getByRole('button', { name: OPEN_LEAVE_LABEL }))
        .then(() => {
            expect(leaveGroup).not.toHaveBeenCalled();
            return user.click(screen.getByRole('button', { name: 'common:buttons.leaveGroup' }));
        })
        .then(() =>
            waitFor(() =>
                expect(leaveGroup).toHaveBeenCalledWith({
                    groupId: group.id,
                }),
            ),
        );
});
