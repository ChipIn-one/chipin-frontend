import { useState } from 'react';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ModalRouter from './ModalRouter';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const ModalRouterHarness = () => {
    const [isOpened, setIsOpened] = useState(false);

    return (
        <ModalRouter<'choose' | 'payment' | 'review'>
            initialRoute="choose"
            isOpened={isOpened}
            onOpenChange={setIsOpened}
            triggerElement={<button type="button">Open flow</button>}
            routes={{
                choose: {
                    title: 'Choose debt',
                    accessibleDescription: 'Pick a debt',
                    render: navigation => (
                        <button type="button" onClick={() => navigation.push('payment')}>
                            Select debt
                        </button>
                    ),
                },
                payment: {
                    title: 'Record payment',
                    accessibleDescription: 'Enter payment',
                    render: navigation => (
                        <button type="button" onClick={() => navigation.push('review')}>
                            Review payment
                        </button>
                    ),
                },
                review: {
                    title: 'Review payment',
                    accessibleDescription: 'Confirm the payment',
                    render: navigation => (
                        <button type="button" onClick={() => navigation.replace('payment')}>
                            Edit payment
                        </button>
                    ),
                },
            }}
        />
    );
};

test('keeps one dialog node and shows Back next to the title during transitions', () => {
    const user = userEvent.setup();
    render(<ModalRouterHarness />);

    return user
        .click(screen.getByRole('button', { name: 'Open flow' }))
        .then(() => {
            const dialog = screen.getByRole('dialog');
            expect(screen.queryByRole('button', { name: 'buttons.back' })).toBeNull();
            return user.click(screen.getByRole('button', { name: 'Select debt' }))
                .then(() => {
                    expect(screen.getByRole('dialog')).toBe(dialog);
                    expect(screen.getByRole('button', { name: 'buttons.back' })).toBeTruthy();
                    expect(document.activeElement).toBe(
                        screen.getByRole('heading', { name: 'Record payment' }),
                    );
                    return user.click(screen.getByRole('button', { name: 'buttons.back' }));
                })
                .then(() => {
                    expect(screen.getByRole('dialog')).toBe(dialog);
                    expect(screen.queryByRole('button', { name: 'buttons.back' })).toBeNull();
                    expect(screen.getByRole('heading', { name: 'Choose debt' })).toBeTruthy();
                });
        });
});

test('resets history when the flow closes and reopens', () => {
    const user = userEvent.setup();
    render(<ModalRouterHarness />);

    return user
        .click(screen.getByRole('button', { name: 'Open flow' }))
        .then(() => user.click(screen.getByRole('button', { name: 'Select debt' })))
        .then(() => user.click(screen.getByRole('button', { name: 'buttons.close' })))
        .then(() => {
            expect(screen.queryByRole('dialog')).toBeNull();
            return user.click(screen.getByRole('button', { name: 'Open flow' }));
        })
        .then(() => {
            expect(screen.getByRole('heading', { name: 'Choose debt' })).toBeTruthy();
            expect(screen.queryByRole('button', { name: 'buttons.back' })).toBeNull();
        });
});

test('supports history and replacement without a duplicate Back step', () => {
    const user = userEvent.setup();
    render(<ModalRouterHarness />);

    return user
        .click(screen.getByRole('button', { name: 'Open flow' }))
        .then(() => user.click(screen.getByRole('button', { name: 'Select debt' })))
        .then(() => user.click(screen.getByRole('button', { name: 'Review payment' })))
        .then(() => user.click(screen.getByRole('button', { name: 'Edit payment' })))
        .then(() => user.click(screen.getByRole('button', { name: 'buttons.back' })))
        .then(() => {
            expect(screen.getByRole('heading', { name: 'Choose debt' })).toBeTruthy();
            expect(screen.queryByRole('button', { name: 'buttons.back' })).toBeNull();
        });
});

test('Escape closes the complete flow and resets navigation', () => {
    const user = userEvent.setup();
    render(<ModalRouterHarness />);

    return user
        .click(screen.getByRole('button', { name: 'Open flow' }))
        .then(() => user.click(screen.getByRole('button', { name: 'Select debt' })))
        .then(() => user.keyboard('{Escape}'))
        .then(() => {
            expect(screen.queryByRole('dialog')).toBeNull();
            return user.click(screen.getByRole('button', { name: 'Open flow' }));
        })
        .then(() => {
            expect(screen.getByRole('heading', { name: 'Choose debt' })).toBeTruthy();
        });
});
