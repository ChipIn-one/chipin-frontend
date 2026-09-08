import { useState } from 'react';
import { expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BaseAlertDialog from './BaseAlertDialog';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const createDeferredAction = () => {
    let resolveAction: (() => void) | undefined;
    let rejectAction: ((reason?: unknown) => void) | undefined;
    const promise = new Promise<void>((resolve, reject) => {
        resolveAction = resolve;
        rejectAction = reject;
    });

    return {
        promise,
        reject: (reason?: unknown) => rejectAction?.(reason),
        resolve: () => resolveAction?.(),
    };
};

interface HarnessProps {
    onAction: () => Promise<void>;
}

const AlertDialogHarness = ({ onAction }: HarnessProps) => {
    const [isOpened, setIsOpened] = useState(true);

    return (
        <BaseAlertDialog
            isOpened={isOpened}
            setIsOpened={setIsOpened}
            title="Remove item"
            description="This action cannot be undone."
            actionLabel="Remove"
            actionColor="red"
            onAction={onAction}
        />
    );
};

test('keeps a destructive alert open and disables its actions until the request succeeds', () => {
    const action = createDeferredAction();
    const user = userEvent.setup();

    render(<AlertDialogHarness onAction={() => action.promise} />);

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'buttons.close' })).toBeNull();

    return user
        .click(screen.getByRole('button', { name: 'Remove' }))
        .then(() => {
            expect(screen.getByRole('alertdialog')).toBeTruthy();
            expect(screen.getByRole('button', { name: 'buttons.cancel' })).toHaveProperty(
                'disabled',
                true,
            );
            expect(screen.getByRole('button', { name: 'Remove' })).toHaveProperty(
                'disabled',
                true,
            );

            action.resolve();

            return waitFor(() => {
                expect(screen.queryByRole('alertdialog')).toBeNull();
            });
        });
});

test('leaves a destructive alert open when the request fails', () => {
    const action = createDeferredAction();
    const user = userEvent.setup();

    render(<AlertDialogHarness onAction={() => action.promise} />);

    return user
        .click(screen.getByRole('button', { name: 'Remove' }))
        .then(() => {
            action.reject(new Error('Request failed'));

            return waitFor(() => {
                expect(screen.getByRole('alertdialog')).toBeTruthy();
                expect(screen.getByRole('button', { name: 'Remove' })).toHaveProperty(
                    'disabled',
                    false,
                );
            });
        });
});

test('does not dismiss a destructive alert with Escape before or during the request', () => {
    const action = createDeferredAction();
    const user = userEvent.setup();

    render(<AlertDialogHarness onAction={() => action.promise} />);

    return user
        .keyboard('{Escape}')
        .then(() => {
            expect(screen.getByRole('alertdialog')).toBeTruthy();

            return user.click(screen.getByRole('button', { name: 'Remove' }));
        })
        .then(() => user.keyboard('{Escape}'))
        .then(() => {
            expect(screen.getByRole('alertdialog')).toBeTruthy();

            action.resolve();

            return waitFor(() => {
                expect(screen.queryByRole('alertdialog')).toBeNull();
            });
        });
});
