import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ROUTES } from 'constants/routes';
import { lightThemeStyled } from 'constants/styled-themes';
import { usePwaStore } from 'store/pwaStore';

import CtaSection from './CtaSection';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('helpers/pwa', () => ({
    checkIsPwaInstalled: () => false,
}));

vi.mock('components/modals', () => ({
    AuthModal: ({ children }: { children: ReactNode }) => children,
}));

const renderSection = () => {
    render(
        <MemoryRouter initialEntries={[ROUTES.HOME]}>
            <ThemeProvider theme={lightThemeStyled}>
                <CtaSection />
            </ThemeProvider>
        </MemoryRouter>,
    );
};

beforeEach(() => {
    usePwaStore.setState({
        isPwaInstalled: false,
        pwaInstallPrompt: null,
    });
});

test('hides PWA actions when no install prompt is available', () => {
    renderSection();

    expect(screen.queryByRole('button', { name: 'common:buttons.installApp' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'cta.openApp' })).toBeNull();
});

test('hides PWA actions when the PWA is installed', () => {
    usePwaStore.setState({ isPwaInstalled: true });

    renderSection();

    expect(screen.queryByRole('button', { name: 'common:buttons.installApp' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'cta.openApp' })).toBeNull();
});

test('runs the browser install prompt when installation is available', () => {
    const user = userEvent.setup();
    const prompt = vi.fn(() => Promise.resolve());
    const pwaInstallPrompt = Object.assign(new Event('beforeinstallprompt'), {
        platforms: ['web'],
        prompt,
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' }),
    }) satisfies BeforeInstallPromptEvent;
    usePwaStore.setState({ pwaInstallPrompt });

    renderSection();

    return user
        .click(screen.getByRole('button', { name: 'common:buttons.installApp' }))
        .then(() =>
            waitFor(() => {
                expect(prompt).toHaveBeenCalledTimes(1);
                expect(
                    screen.queryByRole('button', { name: 'common:buttons.installApp' }),
                ).toBeNull();
                expect(screen.queryByRole('button', { name: 'cta.openApp' })).toBeNull();
            }),
        );
});
