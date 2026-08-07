import { ThemeProvider } from 'styled-components';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { Group } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useGroupsStore } from 'store/groupsStore';

import ExpenseGroupSearchSelect from './ExpenseGroupSearchSelect';

const group = {
    id: 'group-1',
    name: 'Weekend Trip',
    inviteToken: 'invite-token',
    description: null,
    creator: {
        id: 'user-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        firstName: 'Alice',
        lastName: null,
        picture: null,
        createdAt: 1,
        updatedAt: 1,
    },
    members: [],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: 'https://cdn.example.com/group.webp',
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: { items: [], nextCursor: null },
} satisfies Group;

class LoadedImage {
    complete = true;
    naturalWidth = 1;
    src = '';

    addEventListener(): void {}

    removeEventListener(): void {}
}

beforeEach(() => {
    vi.stubGlobal('Image', LoadedImage);
    useExpenseModalStore.getState().reset();
    useExpenseModalStore.setState({ groupId: group.id });
    useGroupsStore.getState().setInitialGroupsStore();
    useGroupsStore.setState({ groups: [group] });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

test('shows the selected group cover as its avatar', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <ExpenseGroupSearchSelect />
        </ThemeProvider>,
    );

    return screen.findByRole('img', { name: group.name }).then(avatar => {
        expect(avatar).toHaveProperty('src', group.coverUrl);
    });
});
