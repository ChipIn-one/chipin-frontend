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
        const dropdown = screen.getByRole('dialog');

        expect(dropdown.style.getPropertyValue('--width')).toBe(
            'var(--radix-popover-trigger-width)',
        );
        expect(dropdown.style.getPropertyValue('--max-height')).toBe(
            'var(--radix-popover-content-available-height)',
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


test('exposes the selected option with pressed semantics', () => {
    const interaction = userEvent.setup();

    renderSelect({
        items: [
            { value: 'one', label: 'One' },
            { value: 'two', label: 'Two' },
        ],
    });

    return interaction.click(screen.getByRole('button', { name: 'One' })).then(() => {
        expect(
            screen.getByRole('button', {
                name: 'One',
                pressed: true,
            }),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', {
                name: 'Two',
                pressed: false,
            }),
        ).toBeTruthy();
    });
});

test('searchable dropdown renders public language options as actual links', () => {
    const interaction = userEvent.setup();
    renderSelect({
        items: [
            { value: 'en', label: 'English', href: '/privacy', lang: 'en' },
            { value: 'ru', label: 'Russian', href: '/ru/privacy', lang: 'ru' },
        ],
        value: 'en',
    });

    return interaction.click(screen.getByRole('button', { name: 'One' })).then(() => {
        const russianLink = screen.getByRole('link', { name: 'Russian' });
        expect(russianLink.getAttribute('href')).toBe('/ru/privacy');
        expect(russianLink.getAttribute('lang')).toBe('ru');
        expect(screen.getByRole('link', { name: 'English' }).getAttribute('aria-current')).toBe('page');
        return interaction.type(screen.getByRole('textbox', { name: 'Search' }), 'Russian').then(() => {
            expect(screen.getByRole('link', { name: 'Russian' })).toBeTruthy();
            expect(screen.queryByRole('link', { name: 'English' })).toBeNull();
        });
    });
});
