import { useState } from 'react';
import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { lightThemeStyled } from 'constants/styled-themes';

import { RadioCards } from './RadioCards';

const RadioCardsHarness = () => {
    const [value, setValue] = useState('male');

    return (
        <ThemeProvider theme={lightThemeStyled}>
            <RadioCards
                value={value}
                items={[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'hidden', label: 'Unavailable', isDisabled: true },
                ]}
                onValueChange={setValue}
            />
        </ThemeProvider>
    );
};

test('changes the selected radio card without allowing a disabled option', () => {
    const interaction = userEvent.setup();

    render(<RadioCardsHarness />);

    const maleRadio = screen.getByRole('radio', { name: 'Male' });
    const femaleRadio = screen.getByRole('radio', { name: 'Female' });
    const disabledRadio = screen.getByRole('radio', { name: 'Unavailable' });

    expect(maleRadio.getAttribute('aria-checked')).toBe('true');
    expect(femaleRadio.getAttribute('aria-checked')).toBe('false');
    expect((disabledRadio as HTMLButtonElement).disabled).toBe(true);

    return interaction
        .click(femaleRadio)
        .then(() => {
            expect(maleRadio.getAttribute('aria-checked')).toBe('false');
            expect(femaleRadio.getAttribute('aria-checked')).toBe('true');

            return interaction.click(disabledRadio);
        })
        .then(() => {
            expect(femaleRadio.getAttribute('aria-checked')).toBe('true');
            expect(disabledRadio.getAttribute('aria-checked')).toBe('false');
        });
});
