import { expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Dropdown from './Dropdown';

test('exposes a selected radio item in a selectable section', () => {
    const interaction = userEvent.setup();
    const onValueChange = vi.fn();

    render(
        <Theme>
            <Dropdown
                sections={[
                    {
                        label: 'Language',
                        value: 'en',
                        onValueChange,
                        items: [
                            { value: 'en', label: 'English' },
                            { value: 'ru', label: 'Russian' },
                        ],
                    },
                ]}
                trigger={<button type="button">Open menu</button>}
            />
        </Theme>,
    );

    return interaction
        .click(screen.getByRole('button', { name: 'Open menu' }))
        .then(() => {
            expect(
                screen.getByRole('menuitemradio', {
                    name: 'English',
                    checked: true,
                }),
            ).toBeTruthy();

            return interaction.click(
                screen.getByRole('menuitemradio', {
                    name: 'Russian',
                    checked: false,
                }),
            );
        })
        .then(() => {
            expect(onValueChange).toHaveBeenCalledWith('ru');
        });
});
