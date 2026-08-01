import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import InternalPageLayout from './InternalPageLayout';

vi.mock('components/nav-bars', () => ({
    DESKTOP_SHELL_MAX_WIDTH: '1200px',
    DesktopSidebar: () => <aside aria-label="Desktop navigation" />,
    MobileNavBar: () => <nav aria-label="Mobile navigation" />,
}));

test('renders desktop and mobile navigation around internal page content', () => {
    render(
        <InternalPageLayout>
            <main aria-label="Page content" />
        </InternalPageLayout>,
    );

    expect(
        screen.getByRole('complementary', { name: 'Desktop navigation' }),
    ).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeTruthy();
    expect(screen.getByRole('main', { name: 'Page content' })).toBeTruthy();
});
