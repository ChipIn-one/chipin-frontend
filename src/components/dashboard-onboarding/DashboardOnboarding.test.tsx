import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { lightThemeStyled } from 'constants/styled-themes';

import { DashboardOnboarding } from './DashboardOnboarding';

const connectorMocks = vi.hoisted(() => ({
    inviteToken: 'friend-token',
}));

const inviteMocks = vi.hoisted(() => ({
    isNativeShareSupported: false,
    onShare: vi.fn(() => Promise.resolve()),
    onCopyLink: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('components/modals/create-update-group-modal', () => ({
    CreateUpdateGroupModal: ({
        children,
    }: {
        children: React.ReactNode;
    }) => children,
}));

vi.mock('hooks/pwaHooks', () => ({
    useFriendInvite: () => ({
        inviteLink:
            'https://chipin.one/friends/join/friend-token',
        isNativeShareSupported:
            inviteMocks.isNativeShareSupported,
        isShareDone: false,
        isCopied: false,
        qr: {
            title: '',
            accessibleDescription: '',
            description: '',
            subtitle: '',
        },
        onShare: inviteMocks.onShare,
        onCopyLink: inviteMocks.onCopyLink,
    }),
}));

vi.mock('./internal/useConnect', () => ({
    useConnect: () => connectorMocks,
}));

const renderOnboarding = () =>
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <Theme>
                <DashboardOnboarding />
            </Theme>
        </ThemeProvider>,
    );

beforeEach(() => {
    vi.clearAllMocks();
    connectorMocks.inviteToken = 'friend-token';
    inviteMocks.isNativeShareSupported = false;
});

test('DSH-008 shows the single welcome with two actions', () => {
    renderOnboarding();
    expect(screen.getByRole('heading', { name: 'onboarding.welcome.title' })).toBeTruthy();
    const card = screen.getByTestId('dashboard-onboarding-card');
    expect(card.className).toContain('rt-Card');
    expect(card.contains(screen.getByTestId('onboarding-illustration'))).toBe(true);
    expect(card.contains(screen.getByRole('heading', { name: 'onboarding.welcome.title' }))).toBe(true);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'common:buttons.createGroup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'onboarding.actions.inviteFriend' })).toBeTruthy();
});

test('DSH-008 uses copy-link fallback when native share is unavailable', async () => {
    const interaction = userEvent.setup();

    renderOnboarding();

    await interaction.click(
        screen.getByRole('button', {
            name: 'onboarding.actions.inviteFriend',
        }),
    );

    expect(inviteMocks.onCopyLink).toHaveBeenCalledOnce();
    expect(inviteMocks.onShare).not.toHaveBeenCalled();
});

test('DSH-008 uses native share when it is available', async () => {
    const interaction = userEvent.setup();
    inviteMocks.isNativeShareSupported = true;

    renderOnboarding();

    await interaction.click(
        screen.getByRole('button', {
            name: 'onboarding.actions.inviteFriend',
        }),
    );

    expect(inviteMocks.onShare).toHaveBeenCalledOnce();
    expect(inviteMocks.onCopyLink).not.toHaveBeenCalled();
});

