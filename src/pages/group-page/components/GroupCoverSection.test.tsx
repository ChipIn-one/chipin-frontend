import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { Group } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';

import GroupCoverSection from './GroupCoverSection';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('components/modals', importOriginal =>
    importOriginal<typeof import('components/modals')>().then(modals => ({
        ...modals,
        CreateUpdateGroupModal: ({ children }: { children: React.ReactNode }) =>
            children,
    })),
);

vi.mock('components/GroupAvatar', () => ({
    default: () => <div data-testid="group-avatar" />,
}));

const creator = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const group = {
    id: 'group-1',
    name: 'Vietnam',
    inviteToken: 'invite-token',
    description: 'Trip expenses',
    creator,
    members: [{ user: creator, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: 'https://cdn.example.com/group.webp',
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: { items: [], nextCursor: null },
} satisfies Group;

test('opens group editing from a pencil action', () => {
    const { container } = render(
        <ThemeProvider theme={lightThemeStyled}>
            <MemoryRouter>
                <GroupCoverSection group={group} isLoading={false} />
            </MemoryRouter>
        </ThemeProvider>,
    );

    expect(screen.getByRole('button', { name: 'modal.titleEdit' })).toBeTruthy();
    expect(container.querySelector('svg.lucide-pencil')).toBeTruthy();
    expect(container.querySelector('svg.lucide-settings')).toBeNull();
});

test('keeps the group title readable over a cover in the light theme', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <MemoryRouter>
                <GroupCoverSection group={group} isLoading={false} />
            </MemoryRouter>
        </ThemeProvider>,
    );

    expect(getComputedStyle(screen.getByRole('heading', { name: group.name })).color).toBe(
        'rgb(255, 255, 255)',
    );
});

test('keeps group details without member actions inside the hero', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <MemoryRouter>
                <GroupCoverSection group={group} isLoading={false} />
            </MemoryRouter>
        </ThemeProvider>,
    );

    expect(screen.getByText(group.description)).toBeTruthy();
    expect(screen.getByText('dashboard:groupsCard.members')).toBeTruthy();
    expect(screen.queryByTestId('group-avatar')).toBeNull();
    expect(
        screen.queryByRole('button', { name: 'common:buttons.settleUp' }),
    ).toBeNull();
    expect(
        screen.queryByRole('button', { name: 'common:buttons.addExpense' }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'buttons.back' })).toBeTruthy();
    expect(
        screen.queryByRole('button', { name: 'common:buttons.invitePeople' }),
    ).toBeNull();
});

test('uses the shared image fallback when cover is missing', () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <MemoryRouter>
                <GroupCoverSection
                    group={{ ...group, coverUrl: null }}
                    isLoading={false}
                />
            </MemoryRouter>
        </ThemeProvider>,
    );

    expect(screen.queryByAltText('page.coverAlt')).toBeNull();
    expect(screen.getByText('media.noImage')).toBeTruthy();
});
