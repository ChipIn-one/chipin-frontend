import { toast } from 'sonner';
import { beforeEach, expect, test, vi } from 'vitest';

import { act, render, waitFor } from '@testing-library/react';

import { useAuthStore } from 'store/authStore';

import { useAuthToasts } from './useAuthToasts';

vi.mock('i18next', () => ({
    default: {
        t: (key: string) => key,
    },
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        warning: vi.fn(),
    },
}));

const AuthToastsHarness = () => {
    useAuthToasts();
    return null;
};

beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
        isNewUser: null,
        status: 'authenticated',
        unauthReason: undefined,
    });
});

test('shows the dedicated persistence message when this device must sign out', () => {
    render(<AuthToastsHarness />);

    act(() => {
        useAuthStore.setState({
            status: 'unauthenticated',
            unauthReason: 'persistence_error',
        });
    });

    return waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('toasts:auth.tokenPersistenceFailed');
        expect(toast.warning).not.toHaveBeenCalled();
    });
});
