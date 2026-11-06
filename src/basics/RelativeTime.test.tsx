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

import RelativeTime from './RelativeTime';

test('formats time with the time format it is given, and follows a change of it', () => {
    const view = render(<RelativeTime createdAt={1_785_328_628} isTime24H />);

    expect(formatRelativeTimeMock).toHaveBeenLastCalledWith(1_785_328_628, 'en-US', true);

    view.rerender(<RelativeTime createdAt={1_785_328_628} isTime24H={false} />);

    expect(formatRelativeTimeMock).toHaveBeenLastCalledWith(1_785_328_628, 'en-US', false);
});
