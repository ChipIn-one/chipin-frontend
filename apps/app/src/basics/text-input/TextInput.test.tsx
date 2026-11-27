import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

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

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Display name' });
    const description = screen.getByText('Visible to other users');
    const counter = screen.getByText('4 / 5');

    expect(input.value).toBe('Alex');
    expect(input.getAttribute('aria-describedby')).toBe(description.id);
    expect(counter.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);

    return interaction.type(input, 'yz').then(() => {
        expect(input.value).toBe('Alexy');
        expect(screen.getByText('5 / 5')).toBeTruthy();
        expect(onValueChange).toHaveBeenLastCalledWith({ value: 'Alexy', isValid: true });
    });
});

const renderRequiredTextInput = (
    onValueChange?: (state: { value: string; isValid: boolean }) => void,
) =>
    render(
        <TextInput
            id="field"
            label="Display name"
            description="Visible to other users"
            initialValue="Alex"
            isRequired
            validationMessage="Display name is required."
            onValueChange={onValueChange}
        />,
    );

test('hides the validation message until the field loses focus', () => {
    const interaction = userEvent.setup();
    const onValueChange = vi.fn();

    renderRequiredTextInput(onValueChange);

    const input = screen.getByRole('textbox', { name: 'Display name' });

    expect(input.getAttribute('aria-invalid')).toBe('false');

    return interaction
        .clear(input)
        .then(() => interaction.type(input, '   '))
        .then(() => {
            expect(input.getAttribute('aria-invalid')).toBe('true');
            expect(screen.queryByRole('alert')).toBeNull();
            expect(input.getAttribute('aria-describedby')).toBe('field-description');
            expect(onValueChange).toHaveBeenLastCalledWith({ value: '   ', isValid: false });
        });
});

test('shows the validation message below the field after blur and keeps the label', () => {
    const interaction = userEvent.setup();

    renderRequiredTextInput();

    const input = screen.getByRole('textbox', { name: 'Display name' });

    return interaction
        .clear(input)
        .then(() => interaction.tab())
        .then(() => {
            const alert = screen.getByRole('alert');

            expect(alert.textContent).toBe('Display name is required.');
            expect(alert.id).toBe('field-error');
            expect(screen.getByText('Display name').tagName).toBe('LABEL');
            expect(input.getAttribute('aria-invalid')).toBe('true');
            expect(input.getAttribute('aria-describedby')).toBe('field-description field-error');
            expect(
                input.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
            ).not.toBe(0);
        });
});

test('removes the validation message once the value is valid again', () => {
    const interaction = userEvent.setup();

    renderRequiredTextInput();

    const input = screen.getByRole('textbox', { name: 'Display name' });

    return interaction
        .clear(input)
        .then(() => interaction.tab())
        .then(() => interaction.type(input, 'x'))
        .then(() => {
            expect(screen.queryByRole('alert')).toBeNull();
            expect(input.getAttribute('aria-invalid')).toBe('false');
            expect(input.getAttribute('aria-describedby')).toBe('field-description');
        });
});

test('describes the field by the error alone when there is no description', () => {
    const interaction = userEvent.setup();

    render(
        <TextInput
            id="field"
            label="Display name"
            isRequired
            validationMessage="Display name is required."
        />,
    );

    const input = screen.getByRole('textbox', { name: 'Display name' });

    expect(input.getAttribute('aria-describedby')).toBeNull();

    return interaction
        .click(input)
        .then(() => interaction.tab())
        .then(() => {
            expect(input.getAttribute('aria-describedby')).toBe('field-error');
        });
});

test('has no aria-describedby for a valid field without a description', () => {
    render(<TextInput label="Display name" initialValue="Value" />);

    expect(
        screen.getByRole('textbox', { name: 'Display name' }).getAttribute('aria-describedby'),
    ).toBeNull();
});

test('shows no alert for an invalid field without a validation message', () => {
    const interaction = userEvent.setup();

    render(<TextInput label="Display name" isRequired />);

    const input = screen.getByRole('textbox', { name: 'Display name' });

    return interaction
        .click(input)
        .then(() => interaction.tab())
        .then(() => {
            expect(input.getAttribute('aria-invalid')).toBe('true');
            expect(screen.queryByRole('alert')).toBeNull();
        });
});
