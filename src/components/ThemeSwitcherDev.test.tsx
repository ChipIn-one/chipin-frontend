import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

import ThemeSwitcherDev from './ThemeSwitcherDev';

const theme = vi.hoisted(() => ({
    resolvedTheme: 'light',
    setTheme: vi.fn(),
}));

vi.mock('next-themes', () => ({
    useTheme: () => theme,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
    vi.clearAllMocks();
    theme.resolvedTheme = 'light';
});

test.each([
    ['light', 'header.switchToDarkTheme'],
    ['dark', 'header.switchToLightTheme'],
] as const)(
    'describes the theme switch action when the resolved theme is %s',
    (resolvedTheme, accessibleName) => {
        theme.resolvedTheme = resolvedTheme;

        render(
            <Theme>
                <ThemeSwitcherDev />
            </Theme>,
        );

        expect(screen.getByRole('button', { name: accessibleName })).toBeTruthy();
    },
);
