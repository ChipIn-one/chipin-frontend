import { expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import NotificationsSection from './NotificationsSection';

import 'i18n/index';

test('explains that notifications are in development and disables every setting', () => {
    render(<NotificationsSection isLoading={false} />);

    expect(screen.getByText('Notifications are still in development.')).not.toBeNull();

    const switches = screen.getAllByRole('switch');

    expect(switches).toHaveLength(4);
    for (const notificationSwitch of switches) {
        expect((notificationSwitch as HTMLButtonElement).disabled).toBe(true);
    }
});
