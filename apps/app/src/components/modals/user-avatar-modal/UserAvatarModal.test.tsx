import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import { usersKeys } from 'entities/users';
import { useAuthStore } from 'store/authStore';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import { UserAvatarModal } from './UserAvatarModal';

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
    picture: 'https://cdn.example.com/original.png',
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
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
} satisfies SelfUser;

const OPEN_MODAL_LABEL = 'Open avatar modal';
const server = setupMswServer();
let uploads = 0;

const renderModal = () => {
    return render(
        <UserAvatarModal>
            <button type="button">{OPEN_MODAL_LABEL}</button>
        </UserAvatarModal>,
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    uploads = 0;
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    mountAsUserClient().setQueryData(usersKeys.self(), currentUser);

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
            interaction.upload(screen.getByLabelText('avatarModal.pickerLabel'), unsupportedFile),
        )
        .then(() => {
            expect(screen.getByText('avatarModal.errors.unsupportedType')).toBeTruthy();
            // The error look comes from the CSS Module on this state (jsdom does not apply it).
            expect(
                screen
                    .getByLabelText('avatarModal.pickerLabel')
                    .closest('label')
                    ?.getAttribute('data-error'),
            ).toBe('true');
            expect(
                screen.getByRole('button', { name: 'avatarModal.actions.upload' }),
            ).toHaveProperty('disabled', true);
            expect(uploads).toBe(0);
        });
});

test('previews a valid file, shows the upload in progress, and closes after success', () => {
    const interaction = userEvent.setup();
    const file = new File(['avatar'], 'new-avatar.webp', { type: 'image/webp' });
    const updatedUser = { ...currentUser, picture: 'https://cdn.example.com/new-avatar.webp' };
    let resolveUpload: (() => void) | undefined;
    const uploadGate = new Promise<void>(resolve => {
        resolveUpload = resolve;
    });

    server.use(
        http.put('*/users/self/avatar', async () => {
            uploads += 1;
            await uploadGate;
            return HttpResponse.json({ ...updatedUser, isPremium: false });
        }),
    );

    renderModal();

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() => {
            const uploadButton = screen.getByRole('button', {
                name: 'avatarModal.actions.upload',
            });

            expect(uploadButton).toHaveProperty('disabled', true);
            return interaction.upload(screen.getByLabelText('avatarModal.pickerLabel'), file);
        })
        .then(() => {
            expect(screen.getByText(file.name)).toBeTruthy();
            expect(screen.getByRole('img', { name: 'avatarModal.previewLabel' })).toBeTruthy();
            expect(URL.createObjectURL).toHaveBeenCalledWith(file);
            expect(
                screen.getByRole('button', { name: 'avatarModal.actions.upload' }),
            ).toHaveProperty('disabled', false);

            return interaction.click(
                screen.getByRole('button', { name: 'avatarModal.actions.upload' }),
            );
        })
        .then(() => waitFor(() => expect(uploads).toBe(1)))
        .then(() => {
            expect(screen.getByText('avatarModal.uploading')).toBeTruthy();
            expect(
                screen.getByRole('progressbar', { name: 'avatarModal.progressLabel' }),
            ).toBeTruthy();
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

            resolveUpload();

            return waitFor(() => {
                expect(screen.queryByRole('dialog')).toBeNull();
                expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar-preview');
            });
        });
});
