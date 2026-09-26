import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TextArea } from './TextArea';

test('owns its value and exposes the character limit next to the label', () => {
    const interaction = userEvent.setup();
    const onValueChange = vi.fn();

    render(
        <TextArea
            label="Description"
            description="Optional"
            initialValue="Trip"
            maxLength={5}
            onValueChange={onValueChange}
        />,
    );

    const input = screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement;
    const description = screen.getByText('Optional');

    expect(input.value).toBe('Trip');
    expect(input.getAttribute('aria-describedby')).toBe(description.id);
    expect(screen.getByText('4 / 5')).toBeTruthy();

    return interaction.type(input, 'yz').then(() => {
        expect(input.value).toBe('Tripy');
        expect(screen.getByText('5 / 5')).toBeTruthy();
        expect(onValueChange).toHaveBeenLastCalledWith({ value: 'Tripy', isValid: true });
    });
});

test('shows required validation after the textarea loses focus', () => {
    const interaction = userEvent.setup();

    render(
        <TextArea
            label="Description"
            initialValue="Trip"
            isRequired
            validationMessage="Description is required."
        />,
    );

    const input = screen.getByRole('textbox', { name: 'Description' });

    return interaction
        .clear(input)
        .then(() => interaction.type(input, '   '))
        .then(() => interaction.tab())
        .then(() => {
            expect(input.getAttribute('aria-invalid')).toBe('true');
            expect(screen.getByRole('alert').textContent).toBe('Description is required.');
        });
});
