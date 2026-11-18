import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { AmountInput } from './AmountInput';

test('normalizes a comma decimal separator while typing', () => {
    const onChange = vi.fn<(value: string) => void>();
    const user = userEvent.setup();

    render(<AmountInput aria-label="Amount" onChange={onChange} />);

    return user.type(screen.getByRole('textbox', { name: 'Amount' }), '12,5').then(() => {
        expect(onChange).toHaveBeenLastCalledWith('12.5');
    });
});

test('allows unrestricted fractional precision when requested', () => {
    const onChange = vi.fn<(value: string) => void>();
    const user = userEvent.setup();

    render(
        <AmountInput
            aria-label="Amount"
            value="30.1234"
            maxFractionDigits={null}
            onChange={onChange}
        />,
    );

    return user.type(screen.getByRole('textbox', { name: 'Amount' }), '{backspace}').then(() => {
        expect(onChange).toHaveBeenLastCalledWith('30.123');
    });
});

const ControlledAmountInput = ({ maxFractionDigits }: { maxFractionDigits: number }) => {
    const [value, setValue] = useState('');

    return (
        <AmountInput
            aria-label="Amount"
            value={value}
            maxFractionDigits={maxFractionDigits}
            onChange={setValue}
        />
    );
};

test.each([
    [0, '12.5', '125'],
    [0, '12,', '12'],
    [2, '12.5', '12.5'],
    [2, '12,5', '12.5'],
] as const)(
    '#706 with %s fraction digits, typing %s leaves %s in the field',
    (maxFractionDigits, typed, expected) => {
        const user = userEvent.setup();

        render(<ControlledAmountInput maxFractionDigits={maxFractionDigits} />);
        const input = screen.getByRole('textbox', { name: 'Amount' });

        return user.type(input, typed).then(() => {
            expect(input).toHaveProperty('value', expected);
        });
    },
);

test.each([
    [null, '12,5', '12.5'],
    [null, '12,', '12.'],
    [3, '12,', '12.'],
    [3, '12,345', '12.345'],
] as const)(
    '#706 with %s fraction digits, typing %s leaves %s in the field',
    (maxFractionDigits, typed, expected) => {
        const onChange = vi.fn<(value: string) => void>();
        const user = userEvent.setup();

        render(
            <AmountInput
                aria-label="Amount"
                value=""
                maxFractionDigits={maxFractionDigits}
                onChange={onChange}
            />,
        );
        const input = screen.getByRole('textbox', { name: 'Amount' });

        return user
            .click(input)
            .then(() => user.paste(typed))
            .then(() => {
                expect(onChange).toHaveBeenLastCalledWith(expected);
            });
    },
);

test.each(['12.5', '12,', '12.'])(
    '#706 pasting %s into a field without fraction digits leaves it unchanged',
    pasted => {
        const user = userEvent.setup();

        render(<ControlledAmountInput maxFractionDigits={0} />);
        const input = screen.getByRole('textbox', { name: 'Amount' });

        return user
            .type(input, '7')
            .then(() => user.paste(pasted))
            .then(() => {
                expect(input).toHaveProperty('value', '7');
            });
    },
);
