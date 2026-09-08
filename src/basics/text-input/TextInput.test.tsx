import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TextInput } from './TextInput';

test('owns its value and character counter while enforcing the length limit', () => {
    const interaction = userEvent.setup();
    const onValueChange = vi.fn();

    render(
        <TextInput
            label="Display name"
            description="Visible to other users"
            initialValue="Alex"
            maxLength={5}
            onValueChange={onValueChange}
        />,
    );

    const input = screen.getByRole('textbox', { name: 'Display name' }) as HTMLInputElement;
    const description = screen.getByText('Visible to other users');
    const counter = screen.getByText('4 / 5');

    expect(input.value).toBe('Alex');
    expect(input.getAttribute('aria-describedby')).toBe(description.id);
    expect(
        counter.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);

    return interaction.type(input, 'yz').then(() => {
        expect(input.value).toBe('Alexy');
        expect(screen.getByText('5 / 5')).toBeTruthy();
        expect(onValueChange).toHaveBeenLastCalledWith({ value: 'Alexy', isValid: true });
    });
});

test('validates a required value inside the input', () => {
    const interaction = userEvent.setup();
    const onValueChange = vi.fn();

    render(
        <TextInput
            label="Display name"
            initialValue="Alex"
            isRequired
            validationMessage="Display name is required."
            onValueChange={onValueChange}
        />,
    );

    const input = screen.getByRole('textbox', { name: 'Display name' });

    return interaction
        .clear(input)
        .then(() => interaction.type(input, '   '))
        .then(() => interaction.tab())
        .then(() => {
            const validationMessage = screen.getByText('Display name is required.');

            expect(input.getAttribute('aria-invalid')).toBe('true');
            expect(screen.queryByText('Display name')).toBeNull();
            expect(
                validationMessage.compareDocumentPosition(input) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
            ).not.toBe(0);
            expect(onValueChange).toHaveBeenLastCalledWith({ value: '   ', isValid: false });
        });
});
