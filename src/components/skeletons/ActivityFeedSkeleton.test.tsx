import { expect, test, vi } from 'vitest';

import { render } from '@testing-library/react';

import { ActivityFeedSkeleton } from './ActivityFeedSkeleton';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

test('renders the expense-created skeleton feed', () => {
    const { container } = render(<ActivityFeedSkeleton />);

    expect(
        container.querySelector('[data-activity-date-divider-skeleton]'),
    ).toBeTruthy();
    expect(
        container.querySelector(
            '[data-activity-date-divider-summary-skeleton]',
        ),
    ).toBeTruthy();
    expect(
        container.querySelectorAll('[data-activity-event-skeleton]'),
    ).toHaveLength(8);
});

test('can render the date divider without a daily summary', () => {
    const { container } = render(
        <ActivityFeedSkeleton isShowSummary={false} />,
    );

    expect(
        container.querySelector(
            '[data-activity-date-divider-summary-skeleton]',
        ),
    ).toBeNull();
});
