import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ROUTES } from 'constants/routes';
import { usePwaStore } from 'store/pwaStore';

import HeroSection from './HeroSection';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('helpers/pwa', () => ({
    checkIsPwaInstallable: () => false,
    checkIsPwaInstalled: () => false,
}));

vi.mock('components/modals', () => ({
    AuthModal: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('./components', () => ({
    LandingStats: () => null,
}));

const LocationPath = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
};

beforeEach(() => {
    usePwaStore.setState({
        isPwaInstalled: false,
        isPwaInstallable: false,
        pwaInstallPrompt: null,
    });
});

test('opens the app instead of offering installation when the PWA is installed', () => {
    const user = userEvent.setup();
    usePwaStore.setState({ isPwaInstalled: true });

    render(
        <MemoryRouter initialEntries={[ROUTES.HOME]}>
            <HeroSection />
            <LocationPath />
        </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'common:buttons.installApp' })).toBeNull();

    return user
        .click(screen.getByRole('button', { name: 'cta.openApp' }))
        .then(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe(ROUTES.DASHBOARD);
        });
});
