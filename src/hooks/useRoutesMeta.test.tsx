import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useRoutesMeta } from './useRoutesMeta';

import 'i18n/index';

vi.mock('store/groupsStore', () => ({
    useGroupsStore: () => undefined,
}));

const MetadataNavigation = () => {
    useRoutesMeta();

    return (
        <nav>
            <Link to="/">{'Home'}</Link>
            <Link to="/dashboard">{'Dashboard'}</Link>
        </nav>
    );
};

afterEach(() => {
    document
        .querySelectorAll('meta[name="description"], meta[name="robots"], meta[property^="og:"], link[rel="canonical"]')
        .forEach(element => {
            element.remove();
        });
});

test('keeps homepage SEO tags only on the home route during SPA navigation', () => {
    const user = userEvent.setup();

    render(
        <MemoryRouter initialEntries={['/']}>
            <MetadataNavigation />
        </MemoryRouter>,
    );

    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://chipin.one/',
    );
    expect(document.querySelector('meta[property="og:title"]')).not.toBeNull();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();

    return user
        .click(screen.getByRole('link', { name: 'Dashboard' }))
        .then(() => {
            expect(document.querySelector('link[rel="canonical"]')).toBeNull();
            expect(document.querySelector('meta[property^="og:"]')).toBeNull();
            expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
                'noindex, nofollow',
            );
            return user.click(screen.getByRole('link', { name: 'Home' }));
        })
        .then(() => {
            expect(document.querySelector('meta[name="robots"]')).toBeNull();
            expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
                'https://chipin.one/',
            );
            expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
                'https://chipin.one/',
            );
        });
});
