import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { ROUTES } from 'constants/routes';
import { usePwaStore } from 'store/pwaStore';

import HeroSection from './HeroSection';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('helpers/pwa', () => ({
    checkIsPwaInstalled: () => false,
}));

vi.mock('components/modals', () => ({
    AuthModal: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('./components', () => ({
    LandingStats: () => null,
}));

beforeEach(() => {
    usePwaStore.setState({
        isPwaInstalled: false,
        pwaInstallPrompt: null,
    });
});

test('hides PWA actions when the PWA is installed', () => {
    usePwaStore.setState({ isPwaInstalled: true });

    render(
        <MemoryRouter initialEntries={[ROUTES.HOME]}>
            <HeroSection />
        </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'common:buttons.installApp' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'cta.openApp' })).toBeNull();
});

test('hides PWA actions when no install prompt is available', () => {
    usePwaStore.setState({
        isPwaInstalled: false,
        pwaInstallPrompt: null,
    });

    render(
        <MemoryRouter initialEntries={[ROUTES.HOME]}>
            <HeroSection />
        </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'common:buttons.installApp' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'cta.openApp' })).toBeNull();
});

test('offers installation only after the browser provides an install prompt', () => {
    const pwaInstallPrompt = Object.assign(new Event('beforeinstallprompt'), {
        platforms: ['web'],
        prompt: vi.fn(() => Promise.resolve()),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' }),
    }) satisfies BeforeInstallPromptEvent;
    usePwaStore.setState({ isPwaInstalled: false, pwaInstallPrompt });

    render(
        <MemoryRouter initialEntries={[ROUTES.HOME]}>
            <HeroSection />
        </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'common:buttons.installApp' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'cta.openApp' })).toBeNull();
});
