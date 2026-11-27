import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import styles from 'basics/SegmentedControl.module.css';

import { ActivityHeader } from './ActivityHeader';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('removes the settings action and keeps activity filters interactive', () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();

    render(
        <Theme>
            <ActivityHeader isLoading={false} activeFilter="all" onFilterChange={onFilterChange} />
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

test('#969: the filter control fills its column at size 2 with all three labels', () => {
    render(
        <Theme>
            <ActivityHeader isLoading={false} activeFilter="all" onFilterChange={vi.fn()} />
        </Theme>,
    );

    const root = screen
        .getByRole('radio', { name: 'filterAll' })
        .closest('.rt-SegmentedControlRoot');
    if (!(root instanceof HTMLElement)) {
        throw new Error('SegmentedControl root not found');
    }

    expect(root.classList).toContain(styles.fill);
    expect(root.classList).toContain('rt-r-size-2');
    expect([...root.classList].some(name => name.startsWith('sm:'))).toBe(false);
    expect(screen.getByRole('radio', { name: 'filterExpenses' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'filterSettlements' })).toBeTruthy();
});
