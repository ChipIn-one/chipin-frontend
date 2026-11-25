import { render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { Amount } from './Amount';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('keeps a custom prefix inside the non-wrapping amount', () => {
    const { container } = render(
        <Amount
            value={12.5}
            tokenCode="USD"
            symbol=""
            precision={2}
            type="summary"
            customPrefix="~"
        />,
    );

    expect(container.textContent).toBe('~12.5 USD');
    // One root element holds the prefix and the amount (its `nowrap` lives in the CSS Module).
    expect(container.childElementCount).toBe(1);
    expect(container.firstElementChild?.textContent).toBe('~12.5 USD');
});

test('hides a custom prefix when the tiny-amount indicator is present', () => {
    const { container } = render(
        <Amount
            value={0.004}
            tokenCode="USD"
            symbol=""
            precision={2}
            type="summary"
            customPrefix="~"
        />,
    );

    expect(container.textContent).toBe('< 0.01 USD');
    expect(container.textContent).not.toContain('~');
});

test('preserves tiny-amount formatting without a custom prefix', () => {
    const { container } = render(
        <Amount value={0.004} tokenCode="USD" symbol="" precision={2} type="summary" />,
    );

    expect(container.textContent).toBe('< 0.01 USD');
});
