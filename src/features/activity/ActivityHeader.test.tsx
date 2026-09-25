import { expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

import ActivityHeader from './ActivityHeader';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('exposes an accessible name for the activity filter control', () => {
    render(
        <Theme>
            <ActivityHeader
                isLoading={false}
                activeFilter="all"
                onFilterChange={vi.fn()}
            />
        </Theme>,
    );

    expect(screen.getByRole('button', { name: 'filterSettingsAction' })).toBeTruthy();
});
