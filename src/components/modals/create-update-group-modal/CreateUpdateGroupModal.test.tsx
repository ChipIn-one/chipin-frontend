import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Group } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { IMAGE_FILE_ACCEPT } from 'helpers/imageFile';
import type { GroupsStore } from 'store/groupsStore';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';

import CreateUpdateGroupModal from './CreateUpdateGroupModal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { progress?: number }) =>
            options?.progress === undefined ? key : `${key}:${options.progress}`,
    }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

const group = {
    id: 'group-1',
    name: 'Weekend Trip',
    inviteToken: 'invite-token',
    description: 'Trip expenses',
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
    coverUrl: 'https://cdn.example.com/original.webp',
    role: 'OWNER',
    status: 'ACTIVE',
    recentActivities: { items: [], nextCursor: null },
} satisfies Group;

const createGroup = vi.fn<GroupsStore['createGroup']>();
const updateGroup = vi.fn<GroupsStore['updateGroup']>();
const uploadGroupCover = vi.fn<GroupsStore['uploadGroupCover']>();
const OPEN_MODAL_LABEL = 'Open group modal';

const LocationProbe = () => {
    const location = useLocation();

    return <output data-testid="location">{location.pathname}</output>;
};

const renderModal = (type: 'create' | 'update') => {
    return render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <CreateUpdateGroupModal type={type}>
                    <button type="button">{OPEN_MODAL_LABEL}</button>
                </CreateUpdateGroupModal>
                <LocationProbe />
            </ThemeProvider>
        </MemoryRouter>,
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    useGroupsStore.getState().setInitialGroupsStore();
    useGroupsStore.setState({
        selectedGroup: group,
        groups: [group],
        createGroup,
        updateGroup,
        uploadGroupCover,
    });
    useLoadingStore.getState().setInitialLoadingStore();

    Object.defineProperties(URL, {
        createObjectURL: {
            configurable: true,
            value: vi.fn(() => 'blob:group-cover-preview'),
        },
        revokeObjectURL: {
            configurable: true,
            value: vi.fn(),
        },
    });
});

test('hides the cover preview until a file is selected in create mode', () => {
    const interaction = userEvent.setup();

    renderModal('create');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() => {
            const nameInput = screen.getByRole('textbox', { name: 'common:fields.groupName' });
            const coverPicker = screen.getByLabelText('modal.cover.pickerLabel');

            expect(screen.queryByRole('img', { name: 'modal.cover.previewLabel' })).toBeNull();
            expect(coverPicker.getAttribute('accept')).toBe(IMAGE_FILE_ACCEPT);
            expect(nameInput.closest('.rt-TextFieldRoot')?.contains(coverPicker)).toBe(false);
        });
});

test('reveals an optional description in create mode', () => {
    const interaction = userEvent.setup();

    renderModal('create');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() => {
            expect(screen.queryByPlaceholderText('modal.fields.descriptionPlaceholder')).toBeNull();
            const descriptionButton = screen.getByRole('button', {
                name: 'modal.fields.addDescription',
            });

            expect(descriptionButton.classList.contains('rt-variant-outline')).toBe(true);

            return interaction.click(descriptionButton);
        })
        .then(() => {
            const descriptionInput = screen.getByRole('textbox', {
                name: 'common:fields.description',
            });

            expect(descriptionInput.getAttribute('maxlength')).toBe('160');
            expect(screen.getByText('0 / 160')).toBeTruthy();
        });
});

test('preserves the description draft while its field is collapsed', () => {
    const interaction = userEvent.setup();

    renderModal('create');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() =>
            interaction.click(
                screen.getByRole('button', { name: 'modal.fields.addDescription' }),
            ),
        )
        .then(() =>
            interaction.type(
                screen.getByPlaceholderText('modal.fields.descriptionPlaceholder'),
                'Shared trip',
            ),
        )
        .then(() =>
            interaction.click(
                screen.getByRole('button', { name: 'modal.fields.addDescription' }),
            ),
        )
        .then(() => {
            expect(screen.queryByPlaceholderText('modal.fields.descriptionPlaceholder')).toBeNull();
            return interaction.click(
                screen.getByRole('button', { name: 'modal.fields.addDescription' }),
            );
        })
        .then(() => {
            expect(screen.getByPlaceholderText('modal.fields.descriptionPlaceholder')).toHaveProperty(
                'value',
                'Shared trip',
            );
        });
});

test('shows the description textarea immediately in update mode when it is empty', () => {
    const interaction = userEvent.setup();
    const groupWithoutDescription = { ...group, description: null } satisfies Group;

    useGroupsStore.setState({ selectedGroup: groupWithoutDescription });
    renderModal('update');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() => {
            expect(
                screen.queryByRole('button', { name: 'modal.fields.addDescription' }),
            ).toBeNull();
            expect(
                screen.getByRole('textbox', { name: 'common:fields.description' }),
            ).toHaveProperty('value', '');
        });
});

test('keeps the cover picker in the field row when the update cover is null', () => {
    const interaction = userEvent.setup();
    const groupWithoutCover = { ...group, coverUrl: null } satisfies Group;

    useGroupsStore.setState({ selectedGroup: groupWithoutCover });
    renderModal('update');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() => {
            const picker = screen.getByLabelText('modal.cover.pickerLabel');

            expect(getComputedStyle(picker.parentElement as HTMLElement).position).not.toBe(
                'absolute',
            );
        });
});

test('creates a group before uploading the selected cover and closes after both succeed', () => {
    const interaction = userEvent.setup();
    const file = new File(['cover'], 'cover.webp', { type: 'image/webp' });
    let resolveCreate: ((createdGroup: Group) => void) | undefined;
    let resolveUpload: ((updatedGroup: Group) => void) | undefined;
    const createPromise = new Promise<Group>(resolve => {
        resolveCreate = resolve;
    });
    const uploadPromise = new Promise<Group>(resolve => {
        resolveUpload = resolve;
    });

    createGroup.mockReturnValue(createPromise);
    uploadGroupCover.mockImplementation(params => {
        useLoadingStore.getState().setLoading('group', 'cover', 'loading');
        params.onProgress?.(42);
        return uploadPromise.finally(() => {
            useLoadingStore.getState().setLoading('group', 'cover', 'fetched');
        });
    });

    renderModal('create');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() => {
            expect(screen.getByLabelText('modal.cover.pickerLabel').getAttribute('accept')).toBe(
                IMAGE_FILE_ACCEPT,
            );
            return interaction.type(
                screen.getByPlaceholderText('modal.fields.namePlaceholder'),
                'New Trip',
            );
        })
        .then(() =>
            interaction.upload(screen.getByLabelText('modal.cover.pickerLabel'), file),
        )
        .then(() => {
            expect(screen.getByRole('img', { name: 'modal.cover.previewLabel' })).toHaveProperty(
                'src',
                'blob:group-cover-preview',
            );
            return interaction.click(
                screen.getByRole('button', { name: 'common:buttons.createGroup' }),
            );
        })
        .then(() => {
            expect(createGroup).toHaveBeenCalledWith({
                groupName: 'New Trip',
                groupDescription: undefined,
            });
            expect(uploadGroupCover).not.toHaveBeenCalled();

            if (!resolveCreate) {
                throw new Error('Create resolver was not initialized');
            }

            resolveCreate({ ...group, name: 'New Trip' });

            return waitFor(() => {
                expect(uploadGroupCover).toHaveBeenCalledWith({
                    groupId: group.id,
                    file,
                    onProgress: expect.any(Function),
                });
                expect(screen.getByTestId('location').textContent).toBe('/dashboard');
                expect(screen.getByRole('dialog')).toBeTruthy();
                expect(screen.getByText('modal.cover.progress:42')).toBeTruthy();
                expect(screen.getByRole('button', { name: 'buttons.close' })).toHaveProperty(
                    'disabled',
                    true,
                );
                expect(
                    screen.getByRole('button', { name: 'common:buttons.cancel' }),
                ).toHaveProperty('disabled', true);
                expect(
                    screen.getByPlaceholderText('modal.fields.namePlaceholder'),
                ).toHaveProperty('disabled', true);
            });
        })
        .then(() => {
            if (!resolveUpload) {
                throw new Error('Upload resolver was not initialized');
            }

            resolveUpload({ ...group, name: 'New Trip', coverUrl: 'https://cdn/new.webp' });

            return waitFor(() => {
                expect(screen.queryByRole('dialog')).toBeNull();
                expect(screen.getByTestId('location').textContent).toBe(`/group/${group.id}`);
                expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:group-cover-preview');
            });
        });
});

test('navigates to a created group when no cover is selected', () => {
    const interaction = userEvent.setup();
    const createdGroup = { ...group, name: 'New Trip' } satisfies Group;

    createGroup.mockResolvedValue(createdGroup);
    renderModal('create');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() =>
            interaction.type(
                screen.getByPlaceholderText('modal.fields.namePlaceholder'),
                createdGroup.name,
            ),
        )
        .then(() =>
            interaction.click(
                screen.getByRole('button', { name: 'common:buttons.createGroup' }),
            ),
        )
        .then(() =>
            waitFor(() => {
                expect(uploadGroupCover).not.toHaveBeenCalled();
                expect(screen.queryByRole('dialog')).toBeNull();
                expect(screen.getByTestId('location').textContent).toBe(`/group/${createdGroup.id}`);
            }),
        );
});

test('rejects an unsupported cover before updating a group', () => {
    const interaction = userEvent.setup({ applyAccept: false });
    const file = new File(['cover'], 'cover.gif', { type: 'image/gif' });

    renderModal('update');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() => {
            expect(screen.getByRole('img', { name: 'modal.cover.previewLabel' })).toHaveProperty(
                'src',
                group.coverUrl,
            );
            return interaction.upload(screen.getByLabelText('modal.cover.pickerLabel'), file);
        })
        .then(() => {
            expect(screen.getByText('modal.cover.errors.unsupportedType')).toBeTruthy();
            expect(updateGroup).not.toHaveBeenCalled();
            expect(uploadGroupCover).not.toHaveBeenCalled();
        });
});

test('updates group fields without uploading when no new cover is selected', () => {
    const interaction = userEvent.setup();
    const updatedGroup = { ...group, name: 'Renamed Trip' } satisfies Group;

    updateGroup.mockResolvedValue(updatedGroup);
    renderModal('update');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() => interaction.clear(screen.getByPlaceholderText('modal.fields.namePlaceholder')))
        .then(() =>
            interaction.type(
                screen.getByPlaceholderText('modal.fields.namePlaceholder'),
                updatedGroup.name,
            ),
        )
        .then(() =>
            interaction.click(
                screen.getByRole('button', { name: 'common:buttons.saveGroup' }),
            ),
        )
        .then(() => {
            expect(updateGroup).toHaveBeenCalledOnce();
            expect(uploadGroupCover).not.toHaveBeenCalled();
            expect(screen.queryByRole('dialog')).toBeNull();
            expect(screen.getByTestId('location').textContent).toBe('/dashboard');
        });
});

test('clears an existing group description', () => {
    const interaction = userEvent.setup();
    const updatedGroup = { ...group, description: null } satisfies Group;

    updateGroup.mockResolvedValue(updatedGroup);
    renderModal('update');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() =>
            interaction.clear(
                screen.getByRole('textbox', { name: 'common:fields.description' }),
            ),
        )
        .then(() =>
            interaction.click(
                screen.getByRole('button', { name: 'common:buttons.saveGroup' }),
            ),
        )
        .then(() => {
            expect(updateGroup).toHaveBeenCalledWith({
                groupName: group.name,
                groupDescription: '',
            });
        });
});

test('updates group fields before uploading a newly selected cover', () => {
    const interaction = userEvent.setup();
    const file = new File(['cover'], 'cover.png', { type: 'image/png' });
    const updatedGroup = { ...group, name: 'Renamed Trip' } satisfies Group;
    const groupWithCover = {
        ...updatedGroup,
        coverUrl: 'https://cdn.example.com/new.png',
    } satisfies Group;

    updateGroup.mockResolvedValue(updatedGroup);
    uploadGroupCover.mockResolvedValue(groupWithCover);
    renderModal('update');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() => interaction.upload(screen.getByLabelText('modal.cover.pickerLabel'), file))
        .then(() =>
            interaction.click(
                screen.getByRole('button', { name: 'common:buttons.saveGroup' }),
            ),
        )
        .then(() =>
            waitFor(() => {
                expect(updateGroup).toHaveBeenCalledOnce();
                expect(uploadGroupCover).toHaveBeenCalledWith({
                    groupId: updatedGroup.id,
                    file,
                    onProgress: expect.any(Function),
                });
                expect(screen.queryByRole('dialog')).toBeNull();
            }),
        );
});

test('locks created group details while retrying a failed cover upload', () => {
    const interaction = userEvent.setup();
    const file = new File(['cover'], 'cover.webp', { type: 'image/webp' });
    const createdGroup = { ...group, name: 'New Trip' } satisfies Group;

    createGroup.mockResolvedValue(createdGroup);
    uploadGroupCover
        .mockRejectedValueOnce(new Error('Cover upload failed'))
        .mockResolvedValueOnce({ ...createdGroup, coverUrl: 'https://cdn/new.webp' });

    renderModal('create');

    return interaction
        .click(screen.getByRole('button', { name: OPEN_MODAL_LABEL }))
        .then(() =>
            interaction.type(
                screen.getByPlaceholderText('modal.fields.namePlaceholder'),
                createdGroup.name,
            ),
        )
        .then(() =>
            interaction.upload(screen.getByLabelText('modal.cover.pickerLabel'), file),
        )
        .then(() =>
            interaction.click(
                screen.getByRole('button', { name: 'common:buttons.createGroup' }),
            ),
        )
        .then(() =>
            waitFor(() => {
                expect(screen.getByRole('dialog')).toBeTruthy();
                expect(createGroup).toHaveBeenCalledOnce();
                expect(uploadGroupCover).toHaveBeenCalledOnce();
                expect(screen.getByTestId('location').textContent).toBe('/dashboard');
                expect(
                    screen.getByPlaceholderText('modal.fields.namePlaceholder'),
                ).toHaveProperty('disabled', true);
                expect(
                    screen.getByRole('button', { name: 'modal.cover.retry' }),
                ).toBeTruthy();
            }),
        )
        .then(() =>
            interaction.click(
                screen.getByRole('button', { name: 'modal.cover.retry' }),
            ),
        )
        .then(() =>
            waitFor(() => {
                expect(createGroup).toHaveBeenCalledOnce();
                expect(uploadGroupCover).toHaveBeenCalledTimes(2);
                expect(screen.queryByRole('dialog')).toBeNull();
            }),
        );
});
