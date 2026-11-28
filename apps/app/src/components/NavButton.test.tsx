import { PROP_COLOR } from '@chipin/tokens/theme';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MouseEvent } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import { NavButton } from './NavButton';

import styles from './NavButton.module.css';

const LINK_TEXT = 'Go to target';
const BACK_TEXT = 'Back';

const LocationProbe = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const state: unknown = location.state;
    const summary = [location.pathname, JSON.stringify(state ?? null)].join('|');

    return (
        <>
            <p data-testid="location">{summary}</p>
            <button type="button" onClick={() => void navigate(-1)}>
                {BACK_TEXT}
            </button>
        </>
    );
};

const renderNavButton = (props: Partial<Parameters<typeof NavButton>[0]> = {}) =>
    render(
        <MemoryRouter initialEntries={['/home', '/start']} initialIndex={1}>
            <Routes>
                <Route
                    path="/start"
                    element={
                        <NavButton to="/target" {...props}>
                            {LINK_TEXT}
                        </NavButton>
                    }
                />
                <Route path="*" element={<LocationProbe />} />
            </Routes>
        </MemoryRouter>,
    );

// Stand in for the browser's own link handling, which jsdom does not implement: record whether
// the click reached the browser un-prevented and stop jsdom from attempting a navigation.
let browserHandledClick = false;
const onWindowClick = (event: globalThis.MouseEvent) => {
    browserHandledClick = !event.defaultPrevented;
    event.preventDefault();
};

afterEach(() => {
    window.removeEventListener('click', onWindowClick);
    browserHandledClick = false;
});

test('renders a real anchor with the target href and its children inside', () => {
    renderNavButton({ 'aria-current': 'page' });
    const link = screen.getByRole('link', { name: LINK_TEXT });

    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/target');
    expect(link.getAttribute('role')).toBeNull();
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.textContent).toBe(LINK_TEXT);
    expect(link.classList.contains('rt-Button')).toBe(true);
});

test('a plain click navigates in the router and calls the caller click handler', () => {
    const onClick = vi.fn();

    renderNavButton({ onClick });
    fireEvent.click(screen.getByRole('link'));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location').textContent).toBe('/target|null');
});

test('a default-prevented caller click does not navigate', () => {
    renderNavButton({ onClick: (event: MouseEvent<HTMLAnchorElement>) => event.preventDefault() });
    fireEvent.click(screen.getByRole('link'));

    expect(screen.getByRole('link', { name: LINK_TEXT })).toBeTruthy();
    expect(screen.queryByTestId('location')).toBeNull();
});

test('passes state through to the router location', () => {
    renderNavButton({ state: { from: 'start' } });
    fireEvent.click(screen.getByRole('link'));

    expect(screen.getByTestId('location').textContent).toBe('/target|{"from":"start"}');
});

test('replace swaps the current history entry, so going back skips the start page', () => {
    renderNavButton({ replace: true });
    fireEvent.click(screen.getByRole('link'));
    fireEvent.click(screen.getByRole('button', { name: BACK_TEXT }));

    expect(screen.getByTestId('location').textContent).toBe('/home|null');
});

test('without replace, going back returns to the start page', () => {
    renderNavButton();
    fireEvent.click(screen.getByRole('link'));
    fireEvent.click(screen.getByRole('button', { name: BACK_TEXT }));

    expect(screen.getByRole('link', { name: LINK_TEXT })).toBeTruthy();
});

test.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
])('a %s-click is left to the browser and does not navigate in the router', (_, modifier) => {
    const onClick = vi.fn();

    renderNavButton({ onClick });
    window.addEventListener('click', onWindowClick);
    fireEvent.click(screen.getByRole('link'), modifier);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(browserHandledClick).toBe(true);
    expect(screen.getByRole('link', { name: LINK_TEXT })).toBeTruthy();
    expect(screen.queryByTestId('location')).toBeNull();
});

test('unsetStyles applies the unstyled root class to the anchor', () => {
    renderNavButton({ unsetStyles: true, className: 'consumer' });
    const link = screen.getByRole('link');

    expect(link.tagName).toBe('A');
    expect(link.className).toContain(styles.root);
    expect(link.className).toContain('consumer');
});

test('look props style the anchor through Radix and never reach it as DOM attributes', () => {
    renderNavButton({
        variant: 'ghost',
        color: PROP_COLOR.accent,
        size: '3',
        radius: 'full',
        mt: '2',
    });
    const link = screen.getByRole('link');

    expect(link.classList.contains('rt-variant-ghost')).toBe(true);
    expect(link.classList.contains('rt-r-size-3')).toBe(true);
    expect(link.classList.contains('rt-r-mt-2')).toBe(true);
    expect(link.getAttribute('data-accent-color')).toBe(PROP_COLOR.accent);
    expect(link.getAttribute('data-radius')).toBe('full');
    for (const attribute of ['color', 'size', 'variant', 'radius', 'mt']) {
        expect(link.hasAttribute(attribute)).toBe(false);
    }
});
