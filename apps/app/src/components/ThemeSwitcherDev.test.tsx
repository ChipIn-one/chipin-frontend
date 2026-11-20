import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import { LS_KEY_THEME } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';
import { resetAppearanceStore, useAppearanceStore } from 'store/ui-prefs';

import { ThemeSwitcherDev } from './ThemeSwitcherDev';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
    LocalStorage.setRaw(LS_KEY_THEME, 'light');
    resetAppearanceStore();
});

test.each([
    ['light', 'header.switchToDarkTheme'],
    ['dark', 'header.switchToLightTheme'],
] as const)(
    'describes the theme switch action when the resolved theme is %s',
    (resolvedTheme, accessibleName) => {
        useAppearanceStore.getState().setPreference(resolvedTheme);

        render(
            <Theme>
                <ThemeSwitcherDev />
            </Theme>,
        );

        expect(screen.getByRole('button', { name: accessibleName })).toBeTruthy();
    },
);

test('switches the preference to the other theme', async () => {
    const user = userEvent.setup();

    render(
        <Theme>
            <ThemeSwitcherDev />
        </Theme>,
    );
    await user.click(screen.getByRole('button', { name: 'header.switchToDarkTheme' }));

    expect(useAppearanceStore.getState().preference).toBe('dark');
    expect(screen.getByRole('button', { name: 'header.switchToLightTheme' })).toBeTruthy();
});
