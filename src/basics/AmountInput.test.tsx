import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AmountInput from './AmountInput';

test('normalizes a comma decimal separator while typing', () => {
    const onChange = vi.fn<(value: string) => void>();
    const user = userEvent.setup();

    render(<AmountInput aria-label="Amount" onChange={onChange} />);

    return user.type(screen.getByRole('textbox', { name: 'Amount' }), '12,5').then(() => {
        expect(onChange).toHaveBeenLastCalledWith('12.5');
    });
});
