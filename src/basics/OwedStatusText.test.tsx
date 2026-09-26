import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import OwedStatusText from './OwedStatusText';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('describes positive and negative balances from the user perspective', () => {
    const { rerender } = render(
        <OwedStatusText value={25} currencyCode="USD" size="2" />,
    );

    expect(screen.getByText(/common:balances\.youAreOwed/)).toBeTruthy();

    rerender(<OwedStatusText value={-25} currencyCode="USD" size="2" />);

    expect(screen.getByText(/common:balances\.youOwe/)).toBeTruthy();
});
