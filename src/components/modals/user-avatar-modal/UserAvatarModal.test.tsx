import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { User } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { useLoadingStore } from 'store/loadingStore';
import type { UsersStoreActions } from 'store/users-store';
import { useUsersStore } from 'store/users-store';

import UserAvatarModal from './UserAvatarModal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { progress?: number }) =>
            options?.progress === undefined ? key : `${key}:${options.progress}`,
    }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

const currentUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: 'https://cdn.example.com/original.png',
    role: 'USER',
    subscriptionUntil: null,
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'female',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies User;

const OPEN_MODAL_LABEL = 'Open avatar modal';
const uploadUserAvatar = vi.fn<UsersStoreActions['uploadUserAvatar']>();

const renderModal = () => {
    return render(
        <ThemeProvider theme={lightThemeStyled}>
            <UserAvatarModal>
                <button type="button">{OPEN_MODAL_LABEL}</button>
            </UserAvatarModal>
        </ThemeProvider>,
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    useLoadingStore.getState().setInitialLoadingStore();
    useUsersStore.setState({
        user: currentUser,
        localUser: null,
        friends: [],
        uploadUserAvatar,
    });

    Object.defineProperties(URL, {
        createObjectURL: {
            configurable: true,
            value: vi.fn(() => 'blob:avatar-preview'),
        },
        revokeObjectURL: {
            configurable: true,
            value: vi.fn(),
        },
    });
});

test('rejects an unsupported file before starting an upload', () => {
    const interaction = userEvent.setup({ applyAccept: false });
    const unsupportedFile = new File(['avatar'], 'avatar.gif', { type: 'image/gif' });

    renderModal();

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() =>
            interaction.upload(
                screen.getByLabelText('avatarModal.pickerLabel'),
                unsupportedFile,
            ),
        )
        .then(() => {
            expect(screen.getByText('avatarModal.errors.unsupportedType')).toBeTruthy();
            expect(
                screen.getByRole('button', { name: 'avatarModal.actions.upload' }),
            ).toHaveProperty('disabled', true);
            expect(uploadUserAvatar).not.toHaveBeenCalled();
        });
});

test('previews a valid file, shows upload progress, and closes after success', () => {
    const interaction = userEvent.setup();
    const file = new File(['avatar'], 'new-avatar.webp', { type: 'image/webp' });
    const updatedUser = { ...currentUser, picture: 'https://cdn.example.com/new-avatar.webp' };
    let resolveUpload: ((user: User) => void) | undefined;
    const uploadPromise = new Promise<User>(resolve => {
        resolveUpload = resolve;
    });

    uploadUserAvatar.mockImplementation(params => {
        useLoadingStore.getState().setLoading('users', 'avatar', 'loading');
        params.onProgress?.(42);
        return uploadPromise.finally(() => {
            useLoadingStore.getState().setLoading('users', 'avatar', 'fetched');
        });
    });

    renderModal();

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() => {
            const uploadButton = screen.getByRole('button', {
                name: 'avatarModal.actions.upload',
            });

            expect(uploadButton).toHaveProperty('disabled', true);
            return interaction.upload(
                screen.getByLabelText('avatarModal.pickerLabel'),
                file,
            );
        })
        .then(() => {
            expect(screen.getByText(file.name)).toBeTruthy();
            expect(
                screen.getByRole('img', { name: 'avatarModal.previewLabel' }),
            ).toBeTruthy();
            expect(URL.createObjectURL).toHaveBeenCalledWith(file);
            expect(
                screen.getByRole('button', { name: 'avatarModal.actions.upload' }),
            ).toHaveProperty('disabled', false);

            return interaction.click(
                screen.getByRole('button', { name: 'avatarModal.actions.upload' }),
            );
        })
        .then(() => {
            expect(screen.getByText('avatarModal.progress:42')).toBeTruthy();
            expect(
                screen
                    .getByRole('progressbar', { name: 'avatarModal.progressLabel' })
                    .getAttribute('aria-valuenow'),
            ).toBe('42');
            expect(screen.getByRole('button', { name: 'buttons.close' })).toHaveProperty(
                'disabled',
                true,
            );
            expect(screen.getByRole('button', { name: 'common:buttons.cancel' })).toHaveProperty(
                'disabled',
                true,
            );

            if (!resolveUpload) {
                throw new Error('Upload resolver was not initialized');
            }

            resolveUpload(updatedUser);

            return waitFor(() => {
                expect(screen.queryByRole('dialog')).toBeNull();
                expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar-preview');
            });
        });
});
