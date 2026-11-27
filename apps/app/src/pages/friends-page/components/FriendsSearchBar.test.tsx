// #950: the friends search field and the currency filter have accessible names.
import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { FriendsSearchBar } from './FriendsSearchBar';

import 'i18n/index';

const renderBar = (filterKey = 'all') =>
    render(
        <FriendsSearchBar
            search=""
            onSearchChange={vi.fn()}
            currencies={['USD', 'EUR']}
            filterKey={filterKey}
            onFilterChange={vi.fn()}
            isLoading={false}
        />,
        { wrapper: Theme },
    );

test('#950: the search field is named "Search friends"', () => {
    renderBar();

    expect(screen.getByRole('textbox', { name: 'Search friends' })).toBeTruthy();
});

// Radix responsive display classes: the short value shows below `sm`, the full value from `sm`.
const isMobileOnly = (el: HTMLElement) =>
    el.classList.contains('rt-r-display-contents') && el.classList.contains('sm:rt-r-display-none');
const isDesktopOnly = (el: HTMLElement) =>
    el.classList.contains('rt-r-display-none') && el.classList.contains('sm:rt-r-display-contents');

test('#950: the currency filter is named with its current value, shown as text on mobile too', () => {
    renderBar();

    const trigger = screen.getByRole('button', { name: 'Filter by currency: All currencies' });
    const short = screen.getByText('All');
    const full = screen.getByText('All currencies');
    expect(trigger.contains(short) && trigger.contains(full)).toBe(true);
    expect(isMobileOnly(short)).toBe(true);
    expect(isDesktopOnly(full)).toBe(true);
});

test('#950: a selected currency is in the filter name and shown on every screen size', () => {
    renderBar('EUR');

    const trigger = screen.getByRole('button', { name: 'Filter by currency: EUR' });
    const values = screen.getAllByText('EUR');
    expect(values).toHaveLength(2);
    expect(values.every(value => trigger.contains(value))).toBe(true);
    expect(values.some(isMobileOnly) && values.some(isDesktopOnly)).toBe(true);
});
