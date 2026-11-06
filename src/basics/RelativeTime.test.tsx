import { render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

const { formatRelativeTimeMock } = vi.hoisted(() => ({
    formatRelativeTimeMock: vi.fn(() => '20:05'),
}));

vi.mock('helpers/time', () => ({
    formatRelativeTime: formatRelativeTimeMock,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: {
            language: 'en',
            resolvedLanguage: 'en-US',
        },
    }),
}));

vi.mock('helpers/localStorage', () => ({
    getLocalUser: () => ({ settings: { timeFormat: '24h' } }),
}));

import RelativeTime from './RelativeTime';

test('formats time using the user 24-hour preference', () => {
    render(<RelativeTime createdAt={1_785_328_628} />);

    expect(formatRelativeTimeMock).toHaveBeenCalledWith(1_785_328_628, 'en-US', true);
});
