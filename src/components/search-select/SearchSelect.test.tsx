import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { Button, Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { lightThemeStyled } from 'constants/styled-themes';

import type { SearchSelectProps } from './SearchSelect';
import { SearchSelect } from './SearchSelect';

const ITEMS = [{ value: 'one', label: 'One' }];

const renderSelect = (props: Partial<SearchSelectProps> = {}) => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <Theme>
                <SearchSelect
                    items={ITEMS}
                    value="one"
                    searchPlaceholder="Search"
                    emptyText="Nothing found"
                    triggerElement={<Button>{ITEMS[0].label}</Button>}
                    {...props}
                />
            </Theme>
        </ThemeProvider>,
    );
};

test('stretches the trigger and matches the dropdown width by default', () => {
    const interaction = userEvent.setup();

    renderSelect();

    const trigger = screen.getByRole('button', { name: 'One' });

    expect(trigger.style.getPropertyValue('--width')).toBe('100%');

    return interaction.click(trigger).then(() => {
        expect(screen.getByRole('dialog').style.getPropertyValue('--width')).toBe(
            'var(--radix-popover-trigger-width)',
        );
    });
});

test('supports an explicit dropdown width and max width', () => {
    const interaction = userEvent.setup();

    renderSelect({ contentWidth: '320px', contentMaxWidth: 'none' });

    return interaction.click(screen.getByRole('button', { name: 'One' })).then(() => {
        const dropdown = screen.getByRole('dialog');

        expect(dropdown.style.getPropertyValue('--width')).toBe('320px');
        expect(dropdown.style.getPropertyValue('--min-width')).toBe('0');
        expect(dropdown.style.getPropertyValue('--max-width')).toBe('none');
    });
});
