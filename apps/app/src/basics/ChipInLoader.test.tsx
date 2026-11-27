// Issue #946: the loader is a translated status and stops its SMIL animation under
// `prefers-reduced-motion: reduce`.
import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { i18n } from 'i18n';

import { ChipInLoader } from './ChipInLoader';

type ChangeListener = () => void;

/** A `matchMedia` whose reduced-motion answer the test sets and changes. */
const stubReducedMotion = (initial: boolean) => {
    let matches = initial;
    const listeners = new Set<ChangeListener>();

    vi.stubGlobal('matchMedia', (query: string) => ({
        media: query,
        get matches() {
            return query === '(prefers-reduced-motion: reduce)' && matches;
        },
        addEventListener: (_type: 'change', listener: ChangeListener) => listeners.add(listener),
        removeEventListener: (_type: 'change', listener: ChangeListener) =>
            listeners.delete(listener),
    }));

    return (next: boolean) => {
        matches = next;
        for (const listener of listeners) {
            listener();
        }
    };
};

const animateElements = (container: HTMLElement) =>
    container.querySelectorAll('animate, animateTransform');

afterEach(async () => {
    vi.unstubAllGlobals();
    await act(() => i18n.changeLanguage('en'));
});

test('is one status with the translated loading text and a hidden SVG', () => {
    const { container } = render(<ChipInLoader />);

    expect(screen.getByRole('status').textContent).toBe('Loading…');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
});

test('the status text follows the language', async () => {
    await act(() => i18n.changeLanguage('ru'));

    render(<ChipInLoader />);

    expect(screen.getByRole('status').textContent).toBe('Загрузка…');
});

test('animates without a reduced-motion preference', () => {
    stubReducedMotion(false);

    const { container } = render(<ChipInLoader />);

    expect(animateElements(container).length).toBe(3);
});

test('animates when matchMedia is missing (SSR, tests)', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { container } = render(<ChipInLoader />);

    expect(animateElements(container).length).toBe(3);
});

test('renders a static arc without animate elements under reduced motion', () => {
    stubReducedMotion(true);

    const { container } = render(<ChipInLoader />);

    expect(animateElements(container).length).toBe(0);
    expect(container.querySelector('circle')?.getAttribute('stroke-dasharray')).toBe('42 150');
});

test('stops and resumes the animation when the preference changes', () => {
    const setReducedMotion = stubReducedMotion(false);

    const { container } = render(<ChipInLoader />);

    act(() => setReducedMotion(true));
    expect(animateElements(container).length).toBe(0);

    act(() => setReducedMotion(false));
    expect(animateElements(container).length).toBe(3);
});
