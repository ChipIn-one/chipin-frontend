import { expect, test, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import { Amount } from './index';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('passes the formatted amount callback value as a native number', () => {
    const onClick = vi.fn();

    render(<Amount value="12.5" tokenCode="USD" precision={2} onClick={onClick} />);

    fireEvent.click(screen.getByText('12.5 USD'));

    expect(onClick).toHaveBeenCalledWith({ amountString: '12.50', bigAmount: 12.5 });
});

test('renders zero instead of treating it as missing', () => {
    render(<Amount value={0} tokenCode="USD" precision={2} />);

    expect(screen.getByText('0 USD')).toBeTruthy();
});

test('renders the less-than prefix for a too-small positive value', () => {
    render(<Amount value={0.0001} tokenCode="USD" precision={2} />);

    expect(screen.getByText('< 0.01 USD')).toBeTruthy();
});

test.each([null, undefined, 'not-a-number', Number.NaN, Number.POSITIVE_INFINITY] as const)(
    'renders a dash for invalid or absent value %s',
    value => {
        render(<Amount value={value} tokenCode="USD" precision={2} />);

        expect(screen.getByText('—')).toBeTruthy();
    },
);

test('renders the integer validation message for a fractional integer amount', () => {
    render(<Amount value={12.5} tokenCode="USD" type="integer" />);

    expect(screen.getByText('amount.notInteger')).toBeTruthy();
});
