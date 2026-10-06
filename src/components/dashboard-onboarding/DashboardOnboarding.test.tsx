import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { lightThemeStyled } from 'constants/styled-themes';

import { DashboardOnboarding } from './DashboardOnboarding';

const connectorMocks = vi.hoisted(() => ({
    inviteToken: 'friend-token',
    openExpenseModal: vi.fn(),
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

const renderOnboarding = (props: {
    hasFriendTarget: boolean;
    hasGroupTarget: boolean;
}) => {
    return render(
        <ThemeProvider theme={lightThemeStyled}>
            <Theme>
                <DashboardOnboarding {...props} />
            </Theme>
        </ThemeProvider>,
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    connectorMocks.inviteToken = 'friend-token';
    inviteMocks.isNativeShareSupported = false;
});

test.each([
    {
        variant: 'newUser',
        props: {
            hasFriendTarget: false,
            hasGroupTarget: false,
        },
        actions: [
            'common:buttons.createGroup',
            'onboarding.actions.inviteFriend',
        ],
    },
    {
        variant: 'friendReady',
        props: {
            hasFriendTarget: true,
            hasGroupTarget: false,
        },
        actions: [
            'common:buttons.addExpense',
            'common:buttons.createGroup',
        ],
    },
    {
        variant: 'groupReady',
        props: {
            hasFriendTarget: false,
            hasGroupTarget: true,
        },
        actions: [
            'common:buttons.addExpense',
            'onboarding.actions.inviteFriend',
        ],
    },
    {
        variant: 'fullyReady',
        props: {
            hasFriendTarget: true,
            hasGroupTarget: true,
        },
        actions: ['common:buttons.addExpense'],
    },
])(
    'DSH-008/DSH-009 renders the $variant action matrix',
    ({ variant, props, actions }) => {
        renderOnboarding(props);

        expect(
            screen.getByRole('heading', {
                name: `onboarding.${variant}.title`,
            }),
        ).toBeTruthy();
        expect(
            screen.getByTestId('onboarding-illustration'),
        ).toBeTruthy();
        expect(screen.getAllByRole('button')).toHaveLength(
            actions.length,
        );

        actions.forEach(action => {
            expect(
                screen.getByRole('button', {
                    name: action,
                }),
            ).toBeTruthy();
        });
    },
);

test('DSH-008 uses copy-link fallback when native share is unavailable', async () => {
    const interaction = userEvent.setup();

    renderOnboarding({
        hasFriendTarget: false,
        hasGroupTarget: false,
    });

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

    renderOnboarding({
        hasFriendTarget: false,
        hasGroupTarget: true,
    });

    await interaction.click(
        screen.getByRole('button', {
            name: 'onboarding.actions.inviteFriend',
        }),
    );

    expect(inviteMocks.onShare).toHaveBeenCalledOnce();
    expect(inviteMocks.onCopyLink).not.toHaveBeenCalled();
});

test('DSH-009 opens Add Expense from a group-ready onboarding state', async () => {
    const interaction = userEvent.setup();

    renderOnboarding({
        hasFriendTarget: false,
        hasGroupTarget: true,
    });

    await interaction.click(
        screen.getByRole('button', {
            name: 'common:buttons.addExpense',
        }),
    );

    expect(
        connectorMocks.openExpenseModal,
    ).toHaveBeenCalledOnce();
});
