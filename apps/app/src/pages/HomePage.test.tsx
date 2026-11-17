import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import HomePage from './HomePage';

vi.mock('features/landing', () => ({
    CtaSection: () => <section aria-label="CTA" />,
    FeaturesSection: () => <section aria-label="Features" />,
    HeroSection: () => <section aria-label="Hero" />,
    HowItWorksSection: () => <section aria-label="How it works" />,
    ShowcaseSections: () => <section aria-label="Showcase" />,
}));

vi.mock('components/Footer', () => ({ default: () => <footer aria-label="Footer" /> }));

test('keeps every landing section and footer in the intended order', () => {
    render(<HomePage />);

    const sectionLabels = screen
        .getAllByRole('region')
        .map(section => section.getAttribute('aria-label'));

    expect(sectionLabels).toEqual(['Hero', 'Features', 'Showcase', 'How it works', 'CTA']);
    expect(screen.getByRole('contentinfo', { name: 'Footer' })).toBeTruthy();
});
