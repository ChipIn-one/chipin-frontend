import { expect, test, vi } from 'vitest';

import { render } from '@testing-library/react';

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

vi.mock('store/usersSelectors', () => ({
    selectIsUserTime24H: () => true,
}));

vi.mock('store/usersStore', () => ({
    useUsersStore: (selector: () => unknown) => selector(),
}));

import RelativeTime from './RelativeTime';

test('formats time using the user 24-hour preference', () => {
    render(<RelativeTime createdAt={1_785_328_628} />);

    expect(formatRelativeTimeMock).toHaveBeenCalledWith(1_785_328_628, 'en-US', true);
});
