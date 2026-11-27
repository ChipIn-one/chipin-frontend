import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

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

    const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
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

const renderRequiredTextArea = () =>
    render(
        <TextArea
            id="field"
            label="Description"
            description="Optional"
            initialValue="Trip"
            isRequired
            validationMessage="Description is required."
        />,
    );

test('hides the validation message until the field loses focus', () => {
    const interaction = userEvent.setup();

    renderRequiredTextArea();

    const input = screen.getByRole('textbox', { name: 'Description' });

    expect(input.getAttribute('aria-invalid')).toBe('false');

    return interaction
        .clear(input)
        .then(() => interaction.type(input, '   '))
        .then(() => {
            expect(input.getAttribute('aria-invalid')).toBe('true');
            expect(screen.queryByRole('alert')).toBeNull();
            expect(input.getAttribute('aria-describedby')).toBe('field-description');
        });
});

test('shows the validation message below the field after blur and keeps the label', () => {
    const interaction = userEvent.setup();

    renderRequiredTextArea();

    const input = screen.getByRole('textbox', { name: 'Description' });

    return interaction
        .clear(input)
        .then(() => interaction.tab())
        .then(() => {
            const alert = screen.getByRole('alert');

            expect(alert.textContent).toBe('Description is required.');
            expect(alert.id).toBe('field-error');
            expect(screen.getByText('Description').tagName).toBe('LABEL');
            expect(input.getAttribute('aria-invalid')).toBe('true');
            expect(input.getAttribute('aria-describedby')).toBe('field-description field-error');
            expect(
                input.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
            ).not.toBe(0);
        });
});

test('removes the validation message once the value is valid again', () => {
    const interaction = userEvent.setup();

    renderRequiredTextArea();

    const input = screen.getByRole('textbox', { name: 'Description' });

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
