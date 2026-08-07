import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { Group } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';

import GroupCard from './GroupCard';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

class LoadedTestImage {
    complete = true;
    naturalWidth = 1;
    src = '';

    addEventListener(): void {}

    removeEventListener(): void {}
}

beforeEach(() => {
    vi.stubGlobal('Image', LoadedTestImage);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const group = {
    id: 'group-1',
    name: 'Vietnam',
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
    coverUrl: 'https://cdn.example.com/group-cover.webp',
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: { items: [], nextCursor: null },
} satisfies Group;

const renderCard = (cardGroup: Group, isSelected = false) => {
    return render(
        <MemoryRouter>
            <ThemeProvider theme={lightThemeStyled}>
                <GroupCard group={cardGroup} balances={[]} isSelected={isSelected} />
            </ThemeProvider>
        </MemoryRouter>,
    );
};

test('uses the group cover only for the avatar', () => {
    const { container } = renderCard(group);

    return screen.findByRole('img', { name: group.name }).then(avatar => {
        expect(avatar).toHaveProperty('src', group.coverUrl);
        expect(container.querySelectorAll(`img[src="${group.coverUrl}"]`)).toHaveLength(1);
    });
});

test('shows the same dense selection outline for the card', () => {
    const { container } = renderCard(group, true);
    const card = container.querySelector('[data-interactive-card]');

    expect(card).toBeTruthy();
    expect(card?.getAttribute('data-selected')).toBe('true');
    expect(getComputedStyle(card as HTMLElement).outlineStyle).toBe('solid');
    expect(getComputedStyle(card as HTMLElement).outlineWidth).toBe('2px');
});

test('renders the card without cover layers when the API cover is null', () => {
    const groupWithoutCover = { ...group, coverUrl: null } satisfies Group;
    const { container } = renderCard(groupWithoutCover);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(group.name)).toBeTruthy();
});
