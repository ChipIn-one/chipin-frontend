import { toast } from 'sonner';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAuthStore } from 'store/authStore';
import { useLoadingStore } from 'store/loadingStore';

import PrivacySecuritySection from './PrivacySecuritySection';

const translations: Record<string, string> = {
    'common:buttons.signOut': 'Sign out',
    'security.deleteAccountDescription': 'Permanently remove your data.',
    'security.deleteAccountTitle': 'Delete account',
    'security.description': 'Manage your account security and data.',
    'security.exportDataDescription': 'Download all your expenses.',
    'security.exportDataTitle': 'Export data',
    'security.logoutOtherDevicesDescription':
        'End all other active sessions. You’ll stay signed in on this device.',
    'security.logoutOtherDevicesLoading':
        'Signing out on other devices… You’ll stay signed in here.',
    'security.logoutOtherDevicesTitle': 'Sign out on other devices',
    'security.signOutDescription':
        'End this session only. Other devices will stay signed in.',
    'security.signOutTitle': 'Sign out on this device',
    'security.title': 'Privacy & Security',
    'toasts:settings.logoutOtherDevicesSuccess':
        'Signed out on all other devices. You’re still signed in here.',
    'toasts:common.requestFailed': 'Request failed',
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => translations[key] ?? key,
    }),
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
    useLoadingStore.getState().setInitialLoadingStore();
    useAuthStore.setState({
        isNewUser: null,
        status: 'authenticated',
        unauthReason: undefined,
    });
});

test('distinguishes other-device logout and starts it directly from the card', () => {
    const user = userEvent.setup();
    const logoutOtherDevices = vi.fn(() => Promise.resolve());
    useAuthStore.setState({ logoutOtherDevices });

    render(<PrivacySecuritySection isLoading={false} />);

    expect(
        screen.getByText(
            'End all other active sessions. You’ll stay signed in on this device.',
        ),
    ).toBeTruthy();
    expect(screen.getByText('Sign out on this device')).toBeTruthy();
    expect(
        screen.getByText('End this session only. Other devices will stay signed in.'),
    ).toBeTruthy();

    return user
        .click(screen.getByRole('button', { name: /sign out on other devices/i }))
        .then(() => {
            expect(logoutOtherDevices).toHaveBeenCalledOnce();
        });
});

test('blocks repeated clicks, shows pending copy, and reports success after resolve', () => {
    const user = userEvent.setup();
    let resolveRequest: (() => void) | undefined;
    const request = new Promise<void>(resolve => {
        resolveRequest = resolve;
    });
    const logoutOtherDevices = vi.fn(() => {
        useLoadingStore
            .getState()
            .setLoading('auth', 'logoutOtherDevices', 'loading');

        return request.finally(() => {
            useLoadingStore
                .getState()
                .setLoading('auth', 'logoutOtherDevices', 'fetched');
        });
    });
    useAuthStore.setState({ logoutOtherDevices });

    render(<PrivacySecuritySection isLoading={false} />);

    return user
        .click(screen.getByRole('button', { name: /sign out on other devices/i }))
        .then(() => {
            expect(logoutOtherDevices).toHaveBeenCalledOnce();
            expect(
                screen.getByText(
                    'Signing out on other devices… You’ll stay signed in here.',
                ),
            ).toBeTruthy();

            return user.click(
                screen.getByRole('button', { name: /signing out on other devices/i }),
            );
        })
        .then(() => {
            expect(logoutOtherDevices).toHaveBeenCalledOnce();
            resolveRequest?.();

            return waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith(
                    'Signed out on all other devices. You’re still signed in here.',
                );
            });
        });
});

test('does not show success and keeps the card retryable after an error', () => {
    const user = userEvent.setup();
    const logoutOtherDevices = vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error('Validation failed'))
        .mockResolvedValueOnce();
    useAuthStore.setState({ logoutOtherDevices });

    render(<PrivacySecuritySection isLoading={false} />);

    return user
        .click(screen.getByRole('button', { name: /sign out on other devices/i }))
        .then(() =>
            waitFor(() => {
                expect(logoutOtherDevices).toHaveBeenCalledOnce();
                expect(toast.success).not.toHaveBeenCalled();
            }),
        )
        .then(() =>
            user.click(
                screen.getByRole('button', { name: /sign out on other devices/i }),
            ),
        )
        .then(() => {
            expect(logoutOtherDevices).toHaveBeenCalledTimes(2);
            expect(toast.success).toHaveBeenCalledOnce();
        });
});
