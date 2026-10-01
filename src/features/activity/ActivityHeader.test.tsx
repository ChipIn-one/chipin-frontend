import { expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ActivityHeader from './ActivityHeader';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('removes the settings action and keeps activity filters interactive', () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();

    render(
        <Theme>
            <ActivityHeader
                isLoading={false}
                activeFilter="all"
                onFilterChange={onFilterChange}
            />
        </Theme>,
    );

    expect(screen.queryByRole('button', { name: 'filterSettingsAction' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'filterAll' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'filterExpenses' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'filterSettlements' })).toBeTruthy();

    return user.click(screen.getByRole('radio', { name: 'filterExpenses' })).then(() => {
        expect(onFilterChange).toHaveBeenCalledWith('expenses');
    });
});
