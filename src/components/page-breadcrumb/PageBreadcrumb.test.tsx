import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PageBreadcrumb } from 'components/page-breadcrumb';

import 'i18n/index';

const ACTION_LABEL = 'Edit';

const CurrentRoute = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
};

const renderBreadcrumb = (
    initialEntries: string[],
    action: ReactNode = null,
    initialIndex?: number,
) => {
    render(
        <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
            <PageBreadcrumb
                title="History"
                subtitle="Expense details"
                action={action}
            />
            <Routes>
                <Route path="*" element={<CurrentRoute />} />
            </Routes>
        </MemoryRouter>,
    );
};

test('renders the supplied title on a breadcrumb-enabled route', () => {
    renderBreadcrumb(['/activity/activity-1']);

    expect(screen.getByText('History')).toBeTruthy();
});

test('renders an optional subtitle without requiring one', () => {
    renderBreadcrumb(['/activity/activity-1']);

    expect(screen.getByText('Expense details')).toBeTruthy();
});

test('renders an optional action without reserving an empty action slot', () => {
    renderBreadcrumb(
        ['/activity/activity-1'],
        <button type="button">{ACTION_LABEL}</button>,
    );

    expect(screen.getByRole('button', { name: ACTION_LABEL })).toBeTruthy();
});

test('gives the icon-only Back link a translated accessible name', () => {
    renderBreadcrumb(['/activity/activity-1']);

    expect(screen.getByRole('link', { name: 'Back' })).toBeTruthy();
});

test('navigates Back to the declarative structural parent', () => {
    const user = userEvent.setup();

    renderBreadcrumb(['/settings', '/activity/activity-1'], null, 1);

    return user
        .click(screen.getByRole('link', { name: 'Back' }))
        .then(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe('/activity');
        });
});

test('does not let a previous history entry determine the structural Back destination', () => {
    const user = userEvent.setup();

    renderBreadcrumb(['/activity', '/settings', '/activity/activity-1'], null, 2);

    return user
        .click(screen.getByRole('link', { name: 'Back' }))
        .then(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe('/activity');
        });
});

test('does not render on a route without breadcrumb opt-in', () => {
    renderBreadcrumb(['/group/group-1']);

    expect(screen.queryByText('History')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
});
