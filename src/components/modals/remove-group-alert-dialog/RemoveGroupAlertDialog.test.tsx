import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';

import RemoveGroupAlertDialog from './RemoveGroupAlertDialog';

const OPEN_REMOVE_LABEL = 'Open removal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

beforeEach(() => {
    vi.clearAllMocks();
    useLoadingStore.getState().setInitialLoadingStore();
});

test('waits for confirmation before removing a group', () => {
    const removeGroup = vi.fn().mockResolvedValue('Trip');
    const user = userEvent.setup();

    useGroupsStore.setState({ removeGroup });

    render(
        <MemoryRouter>
            <RemoveGroupAlertDialog>
                <button type="button">{OPEN_REMOVE_LABEL}</button>
            </RemoveGroupAlertDialog>
        </MemoryRouter>,
    );

    return user
        .click(screen.getByRole('button', { name: OPEN_REMOVE_LABEL }))
        .then(() => {
            expect(screen.getByRole('alertdialog')).toBeTruthy();
            expect(removeGroup).not.toHaveBeenCalled();
            return user.click(screen.getByRole('button', { name: 'common:buttons.delete' }));
        })
        .then(() => waitFor(() => expect(removeGroup).toHaveBeenCalledOnce()));
});
